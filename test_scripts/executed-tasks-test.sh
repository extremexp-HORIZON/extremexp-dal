#!/bin/bash

BASE_URL="https://api.expvis.smartarch.cz"
AUTH_TOKEN="83cfd5b9c323bde78d21fe6cfc27349cc6ca7201"
TASK_ENDPOINT="/api/executed-tasks"
ES_HOST="http://localhost:9200"
INDEX_NAME="executed_tasks"

add_executed_task() {
    local id=$1
    local name=$2
    local start=$3
    local end=$4
    local characteristics=$5
    local executedWorkflow=$6
    echo "$BASE_URL$TASK_ENDPOINT"
    curl -X POST "$BASE_URL$TASK_ENDPOINT" \
        -H "Content-Type: application/json" \
        -H "access-token: $AUTH_TOKEN" \
        -d '{
            "id": "'"$id"'",
            "name": "'"$name"'",
            "start": "'"$start"'",
            "end": "'"$end"'",
            "characteristics": '"$characteristics"',
            "executedWorkflow": "'"$executedWorkflow"'"
        }'
}

query_executed_tasks() {
    local query_params=$1

    local response=$(curl -s -G "$BASE_URL$TASK_ENDPOINT$query_params" \
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

refresh_index() {
    local index=$1
    curl -X POST "$ES_HOST/$index/_refresh"
}

echo "Adding executed tasks..."
add_executed_task "Task001-2024-04-29" "Task 1" "2024-04-29T09:12:33.001Z" "2024-04-29T10:13:35.001Z" '[{"key": "type_of_experiment", "value": "ML"}]' "Exp001-2024-04-29"
add_executed_task "Task002-2024-04-30" "Task 2" "2024-04-30T09:12:33.001Z" "2024-04-30T10:13:35.001Z" '[{"key": "type_of_experiment", "value": "DL"}]' "Exp002-2024-04-30"
add_executed_task "Task003-2024-05-01" "Task 3" "2024-05-01T09:12:33.001Z" "2024-05-01T10:13:35.001Z" '[{"key": "type_of_experiment", "value": "ML"}, {"key": "experiment_location", "value": "lab"}]' "Exp003-2024-05-01"

echo "Refreshing index..."
refresh_index $INDEX_NAME

echo "Every task"
query_executed_tasks ""

echo "Querying executed tasks with key=type_of_experiment and value=ML"
query_executed_tasks "?key=type_of_experiment&value=ML"

echo "Querying executed tasks with key=type_of_experiment and value=ML and key=experiment_location and value=lab..."
query_executed_tasks "?key=type_of_experiment&value=ML&key=experiment_location&value=lab"
