#!/bin/bash

ES_HOST="http://localhost:9200"

indices=("executed_experiments" "executed_workflows" "executed_tasks" "metrics" "parameters"
"input_datasets" "output_datasets" "signal_sets")

delete_index_if_exists() {
    local index=$1
    exists=$(curl -s -o /dev/null -w "%{http_code}" -X GET "$ES_HOST/$index/_search?q=*")
    if [ "$exists" -eq 200 ]; then
        echo "Deleting index: $index"
        curl -s -X DELETE "$ES_HOST/$index"
        echo ""
    else
        echo "Index $index does not exist, skipping delete."
        echo ""
    fi
}


# Function to create an index with the correct mappings
create_index() {
    local index=$1
    local mappings=$2
    echo "Creating index: $index"
    curl -s -X PUT "$ES_HOST/$index" -H 'Content-Type: application/json' -d"$mappings"
    echo ""
}

executed_experiments_mapping='
{
  "settings": {
    "number_of_shards": 1,
    "number_of_replicas": 1
  },
  "mappings": {
    "properties": {
      "id": { "type": "keyword" },
      "name": { "type": "text" },
      "status": { "type": "text" },
      "start": { "type": "date" },
      "end": { "type": "date" },
      "metadata": {
        "type": "nested",
        "properties": {
          "key": { "type": "keyword" },
          "value": { "type": "text" }
        }
      },
      "model": { "type": "text" },
      "comment": { "type": "text" },
      "workflowIds": {
        "type": "keyword"
      }
    }
  }
}'


executed_workflows_mappings='
{
    "settings": {
        "number_of_shards": 1,
        "number_of_replicas": 1
    },
    "mappings": {
        "properties": {
            "id": { "type": "keyword" },
            "experimentId" : { "type": "text"},
            "name": { "type": "text" },
            "status": { "type": "text" },
            "deployedWorkflow": { "type": "text" },
            "start": { "type": "date" },
            "end": { "type": "date" },
            "order": {"type": "integer" },
            "metadata": {
                "type": "nested",
                "properties": {
                    "key": { "type": "keyword" },
                    "value": { "type": "text" }
                }
            },
            "comment": { "type": "text" },
            "parameters": {
                "type": "nested",
                "properties": {
                    "name": { "type": "text" },
                    "type": { "type": "keyword" },
                    "value": { "type": "text" },
                    "usedByExecutedTasks": { "type": "keyword" }
                }
            },
            "input_datasets": {
                "type": "nested",
                "properties": {
                    "name": { "type": "text" },
                    "uri": { "type": "text" },
                    "usedByTasks": { "type": "keyword" },
                    "date": { "type": "date" },
                    "checksum": { "type": "text" }
                }
            },
            "metrics": {
                "type": "nested",
                "properties": {
                    "producedByTask": { "type": "keyword" },
                    "name": { "type": "text" },
                    "type": { "type": "keyword" },
                    "value": { "type": "text" },
                    "date": { "type": "date" },
                    "metadata": {
                      "type": "nested",
                      "properties": {
                          "key": { "type": "keyword" },
                          "value": { "type": "text" }
                      }
                    }
                }
            },
            "output_datasets": {
                "type": "nested",
                "properties": {
                    "type": { "type": "keyword" },
                    "value": { "type": "text" },
                    "producedByTask": { "type": "keyword" },
                    "title": { "type": "text" },
                    "date": { "type": "date" },
                    "checksum": { "type": "text" },
                    "description": { "type": "text" }
                }
            },
            "executedTasks": {
                "type": "nested",
                "properties": {
                    "id": { "type": "keyword" },
                    "name": { "type": "text" },
                    "start": { "type": "date" },
                    "end": { "type": "date" },
                    "metadata": {
                        "type": "nested",
                        "properties": {
                            "key": { "type": "keyword" },
                            "value": { "type": "text" }
                        }
                    },
                    "comment": { "type": "text" },
                    "executedWorkflow": { "type": "keyword" },
                    "source_code": { "type": "text" },
                    "parameters": {
                        "type": "nested",
                        "properties": {
                            "name": { "type": "text" },
                            "type": { "type": "keyword" },
                            "value": { "type": "text" }
                        }
                    },
                    "input_datasets": {
                        "type": "nested",
                        "properties": {
                            "title": { "type": "text" },
                            "uri": { "type": "text" },
                            "date": { "type": "date" },
                            "checksum": { "type": "text" }
                        }
                    },
                    "metrics": {
                        "type": "nested",
                        "properties": {
                            "name": { "type": "text" },
                            "type": { "type": "keyword" },
                            "value": { "type": "text" },
                            "date": { "type": "date" }
                        }
                    },
                    "output_datasets": {
                        "type": "nested",
                        "properties": {
                            "type": { "type": "keyword" },
                            "value": { "type": "text" },
                            "title": { "type": "text" },
                            "date": { "type": "date" },
                            "checksum": { "type": "text" },
                            "description": { "type": "text" }
                        }
                    }
                }
            }
        }
    }
}'

executed_tasks_mappings='
{
    "settings": {
        "number_of_shards": 1,
        "number_of_replicas": 1
    },
    "mappings": {
        "properties": {
            "id": { "type": "keyword" },
            "name": { "type": "text" },
            "start": { "type": "date" },
            "end": { "type": "date" },
            "metadata": {
                "type": "nested",
                "properties": {
                    "key": { "type": "keyword" },
                    "value": { "type": "text" }
                }
            },
            "comment": { "type": "text" },
            "executedWorkflow": { "type": "keyword" },
            "source_code": { "type": "text" },
            "parameters": {
                "type": "nested",
                "properties": {
                    "name": { "type": "text" },
                    "type": { "type": "keyword" },
                    "value": { "type": "text" }
                }
            },
            "input_datasets": {
                "type": "nested",
                "properties": {
                    "title": { "type": "text" },
                    "uri": { "type": "text" },
                    "date": { "type": "date" },
                    "checksum": { "type": "text" }
                }
            },
            "metrics": {
                "type": "nested",
                "properties": {
                    "name": { "type": "text" },
                    "type": { "type": "keyword" },
                    "value": { "type": "text" },
                    "date": { "type": "date" }
                }
            },
            "output_datasets": {
                "type": "nested",
                "properties": {
                    "type": { "type": "keyword" },
                    "value": { "type": "text" },
                    "title": { "type": "text" },
                    "date": { "type": "date" },
                    "checksum": { "type": "text" },
                    "description": { "type": "text" }
                }
            }
        }
    }
}'

metrics_mappings='
{
    "settings": {
        "number_of_shards": 1,
        "number_of_replicas": 1
    },
    "mappings": {
        "properties": {
            "executedWorkflowId": { "type": "keyword" },
            "executedTaskId": { "type": "keyword" },
            "type": { "type": "text"},
            "semanticType": { "type" : "text" },
            "name": { "type": "text" },
            "value": { "type": "text" },
            "date": { "type": "date" }
        }
    }
}'

parameters_mappings='
{
    "settings": {
        "number_of_shards": 1,
        "number_of_replicas": 1
    },
    "mappings": {
        "properties": {
            "name": { "type": "text" },
            "type": { "type": "keyword" },
            "value": { "type": "text" },
            "usedByExecutedTasks": { "type": "keyword" }
        }
    }
}'

input_datasets_mappings='
{
    "settings": {
        "number_of_shards": 1,
        "number_of_replicas": 1
    },
    "mappings": {
        "properties": {
            "executedWorkflowId": { "type": "keyword" },
            "executedTaskId": { "type": "keyword" },
            "title": { "type": "text" },
            "uri": { "type": "text" },
            "date": { "type": "date" },
            "checksum": { "type": "text" }
        }
    }
}'

output_datasets_mappings='
{
    "settings": {
        "number_of_shards": 1,
        "number_of_replicas": 1
    },
    "mappings": {
        "properties": {
            "executedWorkflowId": { "type": "keyword" },
            "executedTaskId": { "type": "keyword" },
            "title": { "type": "text" },
            "uri": { "type": "text" },
            "date": { "type": "date" },
            "checksum": { "type": "text" },
            "description": { "type": "text" }
        }
    }
}'

for index in "${indices[@]}"; do
    delete_index_if_exists $index
    case $index in
        "executed_experiments")
            create_index $index "$executed_experiments_mapping"
            ;;
        "executed_workflows")
            create_index $index "$executed_workflows_mappings"
            ;;
        "executed_tasks")
            create_index $index "$executed_tasks_mappings"
            ;;
        "metrics")
            create_index $index "$metrics_mappings"
            ;;
        "parameters")
            create_index $index "$parameters_mappings"
            ;;
        "input_datasets")
            create_index $index "$input_datasets_mappings"
            ;;
        "output_datasets")
            create_index $index "$output_datasets_mappings"
            ;;
    esac
done

echo "Completed recreating indices."
