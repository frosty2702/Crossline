#!/bin/bash

# =============================================================================
# CROSSLINE SETUP SCRIPT
# =============================================================================
# This script sets up the entire Crossline development environment
# Usage: ./setup.sh [--demo] [--production]

set -e  # Exit on any error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Emojis for better UX
ROCKET="🚀"
CHECK="✅"
CROSS="❌"
WARNING="⚠️"
INFO="ℹ️"
GEAR="⚙️"

# Configuration
DEMO_MODE=false
PRODUCTION_MODE=false
SKIP_DEPENDENCIES=false

# Parse command line arguments
while [[ $# -gt 0 ]]; do
  case $1 in
    --demo)
      DEMO_MODE=true
      shift
      ;;
    --production)
      PRODUCTION_MODE=true
      shift
      ;;
    --skip-deps)
      SKIP_DEPENDENCIES=true
      shift
      ;;
    -h|--help)
      echo "Crossline Setup Script"
      echo ""
      echo "Usage: ./setup.sh [OPTIONS]"
      echo ""
      echo "Options:"
      echo "  --demo          Setup for hackathon demo with sample data"
      echo "  --production    Setup for production deployment"
      echo "  --skip-deps     Skip dependency installation"
      echo "  -h, --help      Show this help message"
      echo ""
      exit 0
      ;;
    *)
      echo "Unknown option $1"
      exit 1
      ;;
  esac
done

# Helper functions
print_header() {
    echo ""
    echo -e "${BLUE}=============================================================================${NC}"
    echo -e "${BLUE}$1${NC}"
    echo -e "${BLUE}=============================================================================${NC}"
    echo ""
}

print_step() {
    echo -e "${PURPLE}${GEAR} $1${NC}"
}

print_success() {
    echo -e "${GREEN}${CHECK} $1${NC}"
}

print_error() {
    echo -e "${RED}${CROSS} $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}${WARNING} $1${NC}"
}

print_info() {
    echo -e "${CYAN}${INFO} $1${NC}"
}

# Check if command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Check system requirements
check_requirements() {
    print_step "Checking system requirements..."
    
    local missing_deps=()
    
    # Check Node.js
    if ! command_exists node; then
        missing_deps+=("Node.js (v18+ required)")
    else
        NODE_VERSION=$(node --version | cut -d'v' -f2 | cut -d'.' -f1)
        if [ "$NODE_VERSION" -lt 18 ]; then
            missing_deps+=("Node.js v18+ (current: $(node --version))")
        fi
    fi
    
    # Check npm
    if ! command_exists npm; then
        missing_deps+=("npm")
    fi
    
    # Check git
    if ! command_exists git; then
        missing_deps+=("git")
    fi
    
    # Check MongoDB (optional for demo)
    if ! command_exists mongod && [ "$DEMO_MODE" = true ]; then
        print_warning "MongoDB not found. Demo will use in-memory database."
    fi
    
    # Check Redis (optional)
    if ! command_exists redis-server; then
        print_warning "Redis not found. Background jobs will use in-memory queue."
    fi
    
    if [ ${#missing_deps[@]} -ne 0 ]; then
        print_error "Missing required dependencies:"
        for dep in "${missing_deps[@]}"; do
            echo "  - $dep"
        done
        echo ""
        print_info "Please install the missing dependencies and run the setup script again."
        exit 1
    fi
    
    print_success "All requirements satisfied"
}

# Setup environment variables
setup_environment() {
    print_step "Setting up environment configuration..."
    
    if [ ! -f .env ]; then
        if [ -f .env.example ]; then
            cp .env.example .env
            print_success "Created .env file from template"
        else
            print_error ".env.example not found"
            exit 1
        fi
    else
        print_info ".env file already exists, skipping..."
    fi
    
    # Setup backend environment
    if [ ! -f backend/.env ]; then
        if [ -f backend/.env.example ]; then
            cp backend/.env.example backend/.env
            print_success "Created backend/.env file"
        fi
    fi
    
    # Setup frontend environment
    if [ ! -f frontend/.env ]; then
        echo "REACT_APP_BACKEND_URL=http://localhost:3001" > frontend/.env
        print_success "Created frontend/.env file"
    fi
}

# Install dependencies
install_dependencies() {
    if [ "$SKIP_DEPENDENCIES" = true ]; then
        print_info "Skipping dependency installation as requested"
        return
    fi
    
    print_step "Installing project dependencies..."
    
    # Install root dependencies (Hardhat)
    print_info "Installing smart contract dependencies..."
    npm install
    
    # Install backend dependencies
    print_info "Installing backend dependencies..."
    cd backend
    npm install
    cd ..
    
    # Install frontend dependencies
    print_info "Installing frontend dependencies..."
    cd frontend
    npm install
    cd ..
    
    print_success "All dependencies installed"
}

# Setup database
setup_database() {
    print_step "Setting up database..."
    
    if command_exists mongod; then
        # Check if MongoDB is running
        if ! pgrep mongod > /dev/null; then
            print_info "Starting MongoDB..."
            if command_exists brew; then
                brew services start mongodb-community || true
            else
                sudo systemctl start mongod || true
            fi
        fi
        
        # Wait for MongoDB to be ready
        sleep 2
        
        print_success "Database setup complete"
    else
        print_warning "MongoDB not found, using in-memory database for demo"
    fi
}

# Compile smart contracts
compile_contracts() {
    print_step "Compiling smart contracts..."
    
    npm run compile
    
    print_success "Smart contracts compiled"
}

# Deploy contracts for demo
deploy_demo_contracts() {
    if [ "$DEMO_MODE" = true ]; then
        print_step "Deploying demo contracts to local network..."
        
        # Start Hardhat node in background
        print_info "Starting local blockchain..."
        npm run node > /dev/null 2>&1 &
        HARDHAT_PID=$!
        
        # Wait for network to be ready
        sleep 5
        
        # Deploy contracts
        npm run deploy:local
        
        # Deploy cross-chain adapters
        if [ -f scripts/deploy-crosschain.js ]; then
            node scripts/deploy-crosschain.js --network localhost
        fi
        
        # Run demo script
        npm run demo
        
        print_success "Demo contracts deployed and initialized"
        
        # Keep Hardhat node running
        print_info "Local blockchain running (PID: $HARDHAT_PID)"
        echo "$HARDHAT_PID" > .hardhat.pid
    fi
}

# Setup demo data
setup_demo_data() {
    if [ "$DEMO_MODE" = true ]; then
        print_step "Setting up demo data..."
        
        # Start backend in background to seed data
        cd backend
        npm run seed > /dev/null 2>&1 || true
        cd ..
        
        print_success "Demo data initialized"
    fi
}

# Create helpful scripts
create_scripts() {
    print_step "Creating helper scripts..."
    
    # Create start script
    cat > start.sh << 'EOF'
#!/bin/bash
# Start all Crossline services

echo "🚀 Starting Crossline services..."

# Start MongoDB if not running
if command -v mongod >/dev/null 2>&1 && ! pgrep mongod > /dev/null; then
    echo "Starting MongoDB..."
    if command -v brew >/dev/null 2>&1; then
        brew services start mongodb-community
    else
        sudo systemctl start mongod
    fi
fi

# Start Redis if not running
if command -v redis-server >/dev/null 2>&1 && ! pgrep redis-server > /dev/null; then
    echo "Starting Redis..."
    redis-server --daemonize yes
fi

# Start Hardhat node if PID file doesn't exist
if [ ! -f .hardhat.pid ] || ! kill -0 $(cat .hardhat.pid) 2>/dev/null; then
    echo "Starting local blockchain..."
    npm run node > /dev/null 2>&1 &
    echo $! > .hardhat.pid
    sleep 3
fi

# Start backend
echo "Starting backend server..."
cd backend
npm start &
BACKEND_PID=$!
echo $BACKEND_PID > ../.backend.pid
cd ..

# Start frontend
echo "Starting frontend..."
cd frontend
npm start &
FRONTEND_PID=$!
echo $FRONTEND_PID > ../.frontend.pid
cd ..

echo "✅ All services started!"
echo "📱 Frontend: http://localhost:3000"
echo "🔧 Backend: http://localhost:3001"
echo "⛓️  Blockchain: http://localhost:8545"
echo ""
echo "To stop all services, run: ./stop.sh"
EOF

    # Create stop script
    cat > stop.sh << 'EOF'
#!/bin/bash
# Stop all Crossline services

echo "🛑 Stopping Crossline services..."

# Stop frontend
if [ -f .frontend.pid ]; then
    kill $(cat .frontend.pid) 2>/dev/null || true
    rm .frontend.pid
    echo "Stopped frontend"
fi

# Stop backend
if [ -f .backend.pid ]; then
    kill $(cat .backend.pid) 2>/dev/null || true
    rm .backend.pid
    echo "Stopped backend"
fi

# Stop Hardhat node
if [ -f .hardhat.pid ]; then
    kill $(cat .hardhat.pid) 2>/dev/null || true
    rm .hardhat.pid
    echo "Stopped blockchain"
fi

echo "✅ All services stopped!"
EOF

    # Make scripts executable
    chmod +x start.sh stop.sh
    
    print_success "Helper scripts created (start.sh, stop.sh)"
}

# Print final instructions
print_final_instructions() {
    print_header "${ROCKET} SETUP COMPLETE!"
    
    echo -e "${GREEN}Crossline has been successfully set up!${NC}"
    echo ""
    
    if [ "$DEMO_MODE" = true ]; then
        echo -e "${CYAN}${ROCKET} DEMO MODE ENABLED${NC}"
        echo ""
        echo "Your Crossline demo environment is ready:"
        echo "  📱 Frontend: http://localhost:3000"
        echo "  🔧 Backend:  http://localhost:3001"
        echo "  ⛓️  Local blockchain with deployed contracts"
        echo "  📊 Demo data and sample orders"
        echo ""
        echo "To start all services:"
        echo "  ${YELLOW}./start.sh${NC}"
        echo ""
        echo "To stop all services:"
        echo "  ${YELLOW}./stop.sh${NC}"
    else
        echo "Next steps:"
        echo "  1. Edit .env file with your configuration"
        echo "  2. Start services: ${YELLOW}./start.sh${NC}"
        echo "  3. Deploy contracts: ${YELLOW}npm run deploy:local${NC}"
        echo "  4. Open http://localhost:3000"
    fi
    
    echo ""
    echo -e "${PURPLE}${INFO} Need help? Check README.md for detailed instructions${NC}"
    echo ""
    echo -e "${GREEN}Happy trading! 🎉${NC}"
}

# Main execution
main() {
    print_header "${ROCKET} CROSSLINE SETUP"
    
    echo -e "${CYAN}Welcome to Crossline - Cross-chain Gasless Limit Orders!${NC}"
    echo ""
    
    if [ "$DEMO_MODE" = true ]; then
        print_info "Setting up in DEMO mode for hackathon presentation"
    elif [ "$PRODUCTION_MODE" = true ]; then
        print_info "Setting up for PRODUCTION deployment"
    else
        print_info "Setting up for DEVELOPMENT"
    fi
    
    # Run setup steps
    check_requirements
    setup_environment
    install_dependencies
    setup_database
    compile_contracts
    deploy_demo_contracts
    setup_demo_data
    create_scripts
    
    print_final_instructions
}

# Run main function
main "$@" 