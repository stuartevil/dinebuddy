#!/usr/bin/env python3
"""
Generate a secure SECRET_KEY for production use
"""
import secrets

if __name__ == "__main__":
    secret_key = secrets.token_urlsafe(32)
    print("=" * 60)
    print("🔐 Generated SECRET_KEY for Production")
    print("=" * 60)
    print(f"\n{secret_key}\n")
    print("=" * 60)
    print("⚠️  Store this in AWS Secrets Manager!")
    print("=" * 60)

