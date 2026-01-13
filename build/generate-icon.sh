#!/bin/bash

# Generate macOS-style app icon from Lina logo
# Requires: Inkscape or rsvg-convert, and iconutil

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

# Create a proper macOS icon SVG with squircle background and padding
# macOS icons have ~8% padding on each side (80px on 1024px canvas)
cat > icon-macos.svg << 'EOF'
<svg width="1024" height="1024" viewBox="0 0 1024 1024" fill="none" xmlns="http://www.w3.org/2000/svg">
  <!-- macOS squircle background with padding (80px margin = 864px icon) -->
  <rect x="80" y="80" width="864" height="864" rx="190" fill="#1a1a1a"/>

  <!-- Lina logo scaled and centered (smaller to fit padded area) -->
  <g transform="translate(248, 248) scale(3.0)">
    <path d="M94.2537 68.2582C94.2537 75.7056 100.291 81.7428 107.738 81.7428H162.16C169.607 81.7428 175.644 87.7801 175.644 95.2274V162.169C175.644 169.617 169.607 175.654 162.16 175.654H95.2187C87.7714 175.654 81.7341 169.617 81.7341 162.169V107.739C81.7341 100.292 75.6969 94.2545 68.2495 94.2545H13.8281C6.38076 94.2545 0.343506 88.2173 0.343506 80.7699V13.828C0.343506 6.38065 6.38076 0.343399 13.8281 0.343399H80.7691C88.2164 0.343399 94.2537 6.38065 94.2537 13.828V68.2582Z" fill="#ffffff"/>
    <rect x="0.343506" y="113.031" width="62.607" height="62.607" rx="13.4846" fill="#ffffff"/>
  </g>
</svg>
EOF

echo "Created icon-macos.svg"

# Check if we have the tools
if command -v rsvg-convert &> /dev/null; then
    CONVERTER="rsvg-convert"
elif command -v inkscape &> /dev/null; then
    CONVERTER="inkscape"
else
    echo "Error: Need rsvg-convert or inkscape to convert SVG to PNG"
    echo "Install with: brew install librsvg"
    exit 1
fi

# Create iconset directory
ICONSET="icon.iconset"
rm -rf "$ICONSET"
mkdir -p "$ICONSET"

# Generate all required sizes for macOS
SIZES="16 32 64 128 256 512 1024"

for SIZE in $SIZES; do
    if [ "$CONVERTER" = "rsvg-convert" ]; then
        rsvg-convert -w $SIZE -h $SIZE icon-macos.svg > "$ICONSET/icon_${SIZE}x${SIZE}.png"
        # Also create @2x versions where needed
        if [ $SIZE -le 512 ]; then
            DOUBLE=$((SIZE * 2))
            rsvg-convert -w $DOUBLE -h $DOUBLE icon-macos.svg > "$ICONSET/icon_${SIZE}x${SIZE}@2x.png"
        fi
    else
        inkscape --export-type=png --export-width=$SIZE --export-height=$SIZE icon-macos.svg -o "$ICONSET/icon_${SIZE}x${SIZE}.png"
        if [ $SIZE -le 512 ]; then
            DOUBLE=$((SIZE * 2))
            inkscape --export-type=png --export-width=$DOUBLE --export-height=$DOUBLE icon-macos.svg -o "$ICONSET/icon_${SIZE}x${SIZE}@2x.png"
        fi
    fi
    echo "Generated ${SIZE}x${SIZE}"
done

# Generate .icns file
iconutil -c icns "$ICONSET" -o icon.icns
echo "Generated icon.icns"

# Also create the main icon.png (1024x1024 with transparency)
if [ "$CONVERTER" = "rsvg-convert" ]; then
    rsvg-convert -w 1024 -h 1024 icon-macos.svg > icon.png
else
    inkscape --export-type=png --export-width=1024 --export-height=1024 icon-macos.svg -o icon.png
fi
echo "Generated icon.png"

# Cleanup
rm -rf "$ICONSET"
rm icon-macos.svg

echo "Done! New icons generated:"
ls -la icon.png icon.icns
