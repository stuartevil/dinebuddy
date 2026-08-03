#!/bin/bash
# Script to setup AWS Secrets Manager for DineBuddy

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${GREEN}🔐 DineBuddy AWS Secrets Setup${NC}"
echo "=================================="

# Check if AWS CLI is installed
if ! command -v aws &> /dev/null; then
    echo -e "${RED}❌ AWS CLI not found. Please install it first.${NC}"
    exit 1
fi

# Prompt for environment
echo -e "\n${YELLOW}Select environment:${NC}"
echo "1) Production"
echo "2) Staging"
read -p "Enter choice [1-2]: " env_choice

case $env_choice in
    1)
        ENV="prod"
        ;;
    2)
        ENV="staging"
        ;;
    *)
        echo -e "${RED}Invalid choice${NC}"
        exit 1
        ;;
esac

# Prompt for region
read -p "Enter AWS Region [us-east-1]: " AWS_REGION
AWS_REGION=${AWS_REGION:-us-east-1}

echo -e "\n${GREEN}Setting up secrets for: dinebuddy/${ENV}${NC}"
echo "Region: $AWS_REGION"

# Database credentials
echo -e "\n${YELLOW}📊 Database Credentials:${NC}"
read -p "POSTGRES_USER: " POSTGRES_USER
read -sp "POSTGRES_PASSWORD: " POSTGRES_PASSWORD
echo
read -p "POSTGRES_HOST (RDS endpoint): " POSTGRES_HOST
read -p "POSTGRES_DB [dinebuddy_${ENV}]: " POSTGRES_DB
POSTGRES_DB=${POSTGRES_DB:-dinebuddy_${ENV}}

# Create database secret
echo -e "\n${YELLOW}Creating database secret...${NC}"
aws secretsmanager create-secret \
    --name "dinebuddy/${ENV}/db" \
    --description "DineBuddy ${ENV} database credentials" \
    --secret-string "{\"username\":\"${POSTGRES_USER}\",\"password\":\"${POSTGRES_PASSWORD}\",\"host\":\"${POSTGRES_HOST}\",\"port\":\"5432\",\"dbname\":\"${POSTGRES_DB}\"}" \
    --region ${AWS_REGION} \
    && echo -e "${GREEN}✅ Database secret created${NC}" \
    || echo -e "${YELLOW}⚠️  Secret might already exist. Use update-secret to modify.${NC}"

# Application secrets
echo -e "\n${YELLOW}🔑 Application Secrets:${NC}"
echo "Generating SECRET_KEY..."
SECRET_KEY=$(python3 -c "import secrets; print(secrets.token_urlsafe(32))")
echo "Generated: ${SECRET_KEY:0:20}..."

# Create application secret
echo -e "\n${YELLOW}Creating application secret...${NC}"
aws secretsmanager create-secret \
    --name "dinebuddy/${ENV}/app" \
    --description "DineBuddy ${ENV} application secrets" \
    --secret-string "{\"SECRET_KEY\":\"${SECRET_KEY}\"}" \
    --region ${AWS_REGION} \
    && echo -e "${GREEN}✅ Application secret created${NC}" \
    || echo -e "${YELLOW}⚠️  Secret might already exist. Use update-secret to modify.${NC}"

# Summary
echo -e "\n${GREEN}=================================="
echo "✅ Secrets Setup Complete!"
echo "==================================${NC}"
echo -e "\nSecret ARNs:"
echo "  Database: arn:aws:secretsmanager:${AWS_REGION}:ACCOUNT:secret:dinebuddy/${ENV}/db"
echo "  App:      arn:aws:secretsmanager:${AWS_REGION}:ACCOUNT:secret:dinebuddy/${ENV}/app"

echo -e "\n${YELLOW}Next Steps:${NC}"
echo "1. Update your ECS task definition with these secret ARNs"
echo "2. Ensure your ECS task role has secretsmanager:GetSecretValue permission"
echo "3. Test the deployment"

echo -e "\n${YELLOW}To retrieve secrets:${NC}"
echo "  aws secretsmanager get-secret-value --secret-id dinebuddy/${ENV}/db --region ${AWS_REGION}"
echo "  aws secretsmanager get-secret-value --secret-id dinebuddy/${ENV}/app --region ${AWS_REGION}"

