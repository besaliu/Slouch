#!/bin/bash

# Slouch Ghost Installer for macOS
# Usage: curl -fsSL https://raw.githubusercontent.com/besaliu/Slouch/main/install.sh | bash

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

APP_NAME="Slouch Ghost"
VERSION="0.1.1"
DMG_URL="https://github.com/besaliu/Slouch/releases/download/v${VERSION}/Slouch.Ghost_${VERSION}_aarch64.dmg"
DMG_NAME="SlouchGhost.dmg"
MOUNT_POINT="/Volumes/Slouch Ghost"
INSTALL_PATH="/Applications"

echo ""
echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${CYAN}                    👻 Slouch Ghost Installer                     ${NC}"
echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

# Check if running on macOS
if [[ "$OSTYPE" != "darwin"* ]]; then
    echo -e "${RED}Error: This installer is for macOS only.${NC}"
    echo "For Windows, use: irm https://raw.githubusercontent.com/besaliu/Slouch/main/install.ps1 | iex"
    exit 1
fi

# Check if app is already running
if pgrep -x "Slouch Ghost" > /dev/null; then
    echo -e "${RED}Error: Slouch Ghost is currently running. Please quit the app first.${NC}"
    exit 1
fi

# Download DMG
echo -e "${BLUE}[1/4]${NC} Downloading Slouch Ghost v${VERSION}..."
cd /tmp
curl -fsSL -o "$DMG_NAME" "$DMG_URL"
echo -e "${GREEN}      ✓ Download complete${NC}"

# Mount DMG
echo -e "${BLUE}[2/4]${NC} Mounting disk image..."
hdiutil attach "$DMG_NAME" -quiet
echo -e "${GREEN}      ✓ Mounted${NC}"

# Copy to Applications
echo -e "${BLUE}[3/4]${NC} Installing to /Applications..."
if [ -d "$INSTALL_PATH/$APP_NAME.app" ]; then
    echo "      Removing previous version..."
    rm -rf "$INSTALL_PATH/$APP_NAME.app"
fi
cp -R "$MOUNT_POINT/$APP_NAME.app" "$INSTALL_PATH/"
echo -e "${GREEN}      ✓ Installed${NC}"

# Remove quarantine attribute
echo -e "${BLUE}[4/4]${NC} Configuring permissions..."
xattr -cr "$INSTALL_PATH/$APP_NAME.app"
echo -e "${GREEN}      ✓ Ready to use${NC}"

# Cleanup
echo ""
echo "      Cleaning up..."
hdiutil detach "$MOUNT_POINT" -quiet
rm -f "/tmp/$DMG_NAME"

echo ""
echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${GREEN}      ✓ Slouch Ghost has been installed successfully!            ${NC}"
echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""
echo -e "      Open ${CYAN}Slouch Ghost${NC} from your Applications folder,"
echo -e "      or run: ${CYAN}open -a 'Slouch Ghost'${NC}"
echo ""
echo -e "      ${BLUE}Privacy Note:${NC} All posture detection happens locally."
echo -e "      Your camera feed never leaves your device."
echo ""
