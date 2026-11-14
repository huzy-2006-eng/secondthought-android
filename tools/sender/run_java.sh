#!/bin/sh
# Java twin of the sender check vs the JS one. Needs a JDK and gson (from the Gradle cache).
set -e
ROOT=$(cd "$(dirname "$0")/../.." && pwd)
GSON=$(find ~/.gradle -name "gson-2.1*.jar" | head -1)
OUT=$(mktemp -d)
javac -d "$OUT" -cp "$GSON" "$ROOT"/tools/sender/shim/org/json/*.java "$ROOT/android/app/src/main/java/app/secondthought/guardian/SenderCheck.java" "$ROOT/tools/sender/SenderParity.java" 2>&1 | grep -v JAVA_TOOL || true
java -cp "$OUT:$GSON" SenderParity "$ROOT" 2>&1 | grep -v JAVA_TOOL
node "$ROOT/tools/sender/big.mjs"
java -cp "$OUT:$GSON" SenderParity "$ROOT" big 2>&1 | grep -v JAVA_TOOL
