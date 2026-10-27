#!/bin/bash
# Raster-Test: für einen Ball mehrere dm-Werte parallel.  tools/grid.sh ball dm1 dm2 ...
b=$1; shift
for dm in "$@"; do node tools/quick.js $b 4 $dm & done; wait
