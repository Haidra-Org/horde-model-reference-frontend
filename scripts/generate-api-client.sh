#!/bin/bash
# Generate API Client from OpenAPI Schema
# 
# This script is a wrapper for generate-api-client.js
# See generate-api-client.js for full documentation

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo -e "${RED}Error: Node.js is not installed${NC}"
    exit 1
fi

# Run the generator
node scripts/generate-api-client.js "$@"

exit_code=$?

if [ $exit_code -eq 0 ]; then
    echo -e "${GREEN}API client generation complete!${NC}"
else
    echo -e "${RED}API client generation failed${NC}"
fi

exit $exit_code
