#!/bin/bash
set -e

mongosh <<EOF
use admin
db.auth('$MONGO_INITDB_ROOT_USERNAME', '$MONGO_INITDB_ROOT_PASSWORD')

// Create bambisleep database
use bambisleep

// Create bambisleep-profiles database
use bambisleep-profiles

// Ensure the user has access to both databases
db.getSiblingDB("admin").createUser({
  user: "brandynette",
  pwd: "CNNvfZi",
  roles: [
    { role: "readWrite", db: "bambisleep" },
    { role: "readWrite", db: "bambisleep-profiles" }
  ]
})

print("MongoDB initialization completed")
EOF
