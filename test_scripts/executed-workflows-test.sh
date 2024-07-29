#!/bin/bash

BASE_URL="https://api.expvis.smartarch.cz"
ENDPOINT="/api/executed-workflows"
AUTH_TOKEN="791964e4630979f0b14dfad25fd99c773afe6102"

add_executed_workflow() {
    local id=$1
    local name=$2
    local start=$3
    local end=$4
    local characteristics=$5
    echo "$BASE_URL$ENDPOINT"
    curl -X POST "$BASE_URL$ENDPOINT" \
        -H "Content-Type: application/json" \
        -H "access-token: $AUTH_TOKEN" \
        -d '{
            "id": "'"$id"'",
            "name": "'"$name"'",
            "start": "'"$start"'",
            "end": "'"$end"'",
            "characteristics": '"$characteristics"'
        }'
}

#query_executed_workflows() {
#    local query_params=$1
#
#    curl -G "$BASE_URL$ENDPOINT" \
#        -H "Content-Type: application/json" \
#        -H "access-token: $AUTH_TOKEN" \
#        --data-urlencode "$query_params" | jq .
#}

refresh_index() {
    curl -X POST "http://localhost:9200/executed_workflows/_refresh"
}

query_executed_workflows() {
    local query_params=$1

    local response=$(curl -s -G "$BASE_URL$ENDPOINT$query_params" \
        -H "Content-Type: application/json" \
        -H "access-token: $AUTH_TOKEN")

    if [[ $(echo "$response" | jq -r 'type') == "array" ]]; then
        echo "$response" | jq -r '.[] | .id'
    elif [[ $(echo "$response" | jq -r 'type') == "object" ]]; then
        echo "$response" | jq -r '.data[].id'
    else
        echo "Unexpected response format: $response"
    fi
}

echo "Adding executed workflows..."
add_executed_workflow "Exp001-2024-04-29" "Workflow 1" "2024-04-29T09:12:33.001Z" "2024-04-29T10:13:35.001Z" '[{"key": "type_of_experiment", "value": "ML"}]'
add_executed_workflow "Exp002-2024-04-30" "Workflow 2" "2024-04-30T09:12:33.001Z" "2024-04-30T10:13:35.001Z" '[{"key": "type_of_experiment", "value": "DL"}]'
add_executed_workflow "Exp003-2024-05-01" "Workflow 3" "2024-05-01T09:12:33.001Z" "2024-05-01T10:13:35.001Z" '[{"key": "type_of_experiment", "value": "ML"}, {"key": "experiment_location", "value": "lab"}]'

refresh_index

echo "Querying executed workflows without constraints"
query_executed_workflows ""

echo "Querying executed workflows with key=type_of_experiment and value=ML without human interaction..."
query_executed_workflows "?key=type_of_experiment&value=ML"

echo "Querying executed workflows with key=type_of_experiment and value=ML and value=lab..."
query_executed_workflows "?key=type_of_experiment&value=ML&key=experiment_location&value=lab"

