#!/bin/bash
# Build and push Docker image to AWS ECR

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo -e "${GREEN}🐳 DineBuddy ECR Deployment${NC}"
echo "=============================="

# Configuration
read -p "AWS Account ID: " AWS_ACCOUNT_ID
read -p "AWS Region [us-east-1]: " AWS_REGION
AWS_REGION=${AWS_REGION:-us-east-1}
read -p "ECR Repository Name [dinebuddy]: " ECR_REPO
ECR_REPO=${ECR_REPO:-dinebuddy}
read -p "Image Tag [latest]: " IMAGE_TAG
IMAGE_TAG=${IMAGE_TAG:-latest}

ECR_URI="${AWS_ACCOUNT_ID}.dkr.ecr.${AWS_REGION}.amazonaws.com/${ECR_REPO}"

echo -e "\n${YELLOW}Configuration:${NC}"
echo "  Account: ${AWS_ACCOUNT_ID}"
echo "  Region: ${AWS_REGION}"
echo "  Repository: ${ECR_REPO}"
echo "  Tag: ${IMAGE_TAG}"
echo "  Full URI: ${ECR_URI}:${IMAGE_TAG}"

read -p $'\n'"Continue? (y/n) " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    exit 1
fi

# Create ECR repository if it doesn't exist
echo -e "\n${YELLOW}📦 Checking ECR repository...${NC}"
aws ecr describe-repositories --repository-names ${ECR_REPO} --region ${AWS_REGION} > /dev/null 2>&1 || \
    (echo "Creating repository..." && \
     aws ecr create-repository --repository-name ${ECR_REPO} --region ${AWS_REGION})

# Login to ECR
echo -e "\n${YELLOW}🔐 Logging in to ECR...${NC}"
aws ecr get-login-password --region ${AWS_REGION} | \
    docker login --username AWS --password-stdin ${AWS_ACCOUNT_ID}.dkr.ecr.${AWS_REGION}.amazonaws.com

# Build image
echo -e "\n${YELLOW}🔨 Building Docker image...${NC}"
cd "$(dirname "$0")/.."
docker build -t ${ECR_REPO}:${IMAGE_TAG} ./backend

# Tag image
echo -e "\n${YELLOW}🏷️  Tagging image...${NC}"
docker tag ${ECR_REPO}:${IMAGE_TAG} ${ECR_URI}:${IMAGE_TAG}
docker tag ${ECR_REPO}:${IMAGE_TAG} ${ECR_URI}:latest

# Push image
echo -e "\n${YELLOW}⬆️  Pushing to ECR...${NC}"
docker push ${ECR_URI}:${IMAGE_TAG}
docker push ${ECR_URI}:latest

echo -e "\n${GREEN}=================================="
echo "✅ Deployment Complete!"
echo "==================================${NC}"
echo -e "\nImage URI: ${ECR_URI}:${IMAGE_TAG}"
echo -e "\n${YELLOW}Next Steps:${NC}"
echo "1. Update your ECS task definition with this image URI"
echo "2. Deploy the new task definition to your ECS service"
echo ""
echo "Example ECS update command:"
echo "  aws ecs update-service --cluster YOUR_CLUSTER --service dinebuddy-backend --force-new-deployment"

