#!/bin/bash

# set -xe

cd "$(dirname "$0")" || exit 1

create_tar() {
    local format=$1
    local ext=$2
    local options=$3
    local exclude=$4
    tar $options -cf "out/${format}.tar" -C in .
    if [[ $? -eq 0 ]]; then
        echo "Created: out/${format}.tar"
    else
        echo "Failed!: out/${format}.tar"
    fi
}

# Cleanup

rm out/*.tar

# V7 (Original TAR format)
create_tar "v7" "tar" "--format=v7" "long"

# USTAR (POSIX 1988)
create_tar "ustar" "tar" "--format=ustar" "long"

# GNU TAR (Linux standard)
create_tar "gnu" "tar" "--format=gnu" ""

# PAX TAR (POSIX 2001)
create_tar "pax" "tar" "--format=pax" ""
