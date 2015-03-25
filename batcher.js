/**
 * Copyright 2015 Awear Solutions Ltd
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 **/

module.exports = function(RED) {
  "use strict";

  RED.nodes.registerType("chunkifier", function ChunkifierNode(n) {
    RED.nodes.createNode(this,n);
    this.name = n.name;
    this.maxTopics = Math.max(1, parseInt(n.maxTopics) || 0);
    this.maxMessagesPerTopic = Math.max(1, parseInt(n.maxMessagesPerTopic) || 0);
    this.maxDelay = (n.maxDelay * 1) || 0;

    this.topicsCount = 0;
    this.topics = {};

    var node = this;

    function flushTopic(topic) {
      if (!(topic in node.topics)) {
        return;
      }
      if (node.topics[topic].timeout) {
        clearTimeout(node.topics[topic].timeout);
      }
      node.topicsCount--;
      node.send({
        "topic": topic.slice(1), // remove '#'
        "payload": node.topics[topic].payloads
      });
      delete node.topics[topic];
    }

    function flushAllTopics() {
      for (var existingTopic in node.topics) {
        if (existingTopic[0] == '#') {
          flushTopic(existingTopic);
        }
      }
    }

    this.on("input", function(msg) {
      // Save topics with a leading '#' to avoid javascript internals
      // (for example, a topic named "hasOwnProperty")
      var topic = '#' + ((msg.topic)?(msg.topic):'');

      if (msg.payload) {
        // Add msg.payload
        if (!(topic in node.topics)) {
          node.topics[topic] = {
            "payloads": []
          };
          if (node.maxDelay >= 0) {
            var topicObject = node.topics[topic];
            node.topics[topic].timeout = setTimeout(function() {
              // Safety check - topic object not replaced.
              if (topicObject == node.topics[topic]) {
                delete topicObject.timeout;
                flushTopic(topic);
              }
            }, node.maxDelay);
          }
          node.topicsCount++;
          if (node.topicsCount > node.maxTopics) {
            for (var oldestTopic in node.topics) {
              if (oldestTopic[0] == '#') {
                flushTopic(oldestTopic);
                break;
              }
            }
          }
        }
        node.topics[topic].payloads.push(msg.payload);
        if (node.topics[topic].payloads.length >= node.maxMessagesPerTopic) {
          flushTopic(topic);
        }
      } else {
        // flush topic
        if (topic != '#') {
          flushTopic(topic);
        } else {
          flushAllTopics();
        }
      }
    });

    this.on("close", function() {
      flushAllTopics();
    });

  });
};
