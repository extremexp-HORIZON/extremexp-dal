#!/bin/bash
if [ -z "$1" ]; then
    echo "Usage: $0 'text'"
    exit 1
fi


input_text="$1"

input_file="input.xxp"
output_file="input.json"

echo "$input_text" > "$input_file"

java -jar dms-1.0-SNAPSHOT-jar-with-dependencies.jar "$input_file" --json 

output=$(cat "$output_file")
rm "$input_file" "$output_file"
echo "$output"

