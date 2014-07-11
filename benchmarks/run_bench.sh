#!/bin/sh
node ./baseNextTick.js
node ./zonedNextTick.js
node ./createZone.js

which gobench 1> /dev/null 2> /dev/null
if [ $? -ne 0 ]; then
  echo -e "\n";
  echo "Unable to perform additional benchmarks.";
  echo "Please install gobench (go get github.com/cmpxchg16/gobench)";
  echo "and ensure that it is available on the \$PATH";
  exit 0;
fi

node ./basicServer.js &
sleep 1
gobench -c=200 -k=true -r=501 -u="http://127.0.0.1:3001" 2>/dev/null 1>/dev/null
sleep 1
node ./basicServerWithZones.js &
sleep 1
gobench -c=200 -k=true -r=501 -u="http://127.0.0.1:3001" 2>/dev/null 1>/dev/null
sleep 1
node ./zonedServer.js &
sleep 1
gobench -c=200 -k=true -r=501 -u="http://127.0.0.1:3001" 2>/dev/null 1>/dev/null
