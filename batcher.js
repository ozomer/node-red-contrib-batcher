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
/* jshint esversion: 6 */

module.exports = function(RED) {
  "use strict";

  RED.nodes.registerType("batcher", function BatcherNode(n) {
    RED.nodes.createNode(this,n);
    this.name = n.name;
    this.maxTopics = Math.max(1, parseInt(n.maxTopics) || 0);
    this.maxMessagesPerTopic = Math.max(1, parseInt(n.maxMessagesPerTopic) || 0);
    this.maxDelay = (n.maxDelay * 1) || 0;

    this.topicCount = 0;
    this.batches = new Map();
    // Maintain a linked-list of topics.
    this.oldestTopic = null;
    this.newestTopic = null;

    const node = this;

    function flushTopic(topic) {
      const batch = node.batches.get(topic);
      if (!batch) {
        return;
      }
      if (batch.timeout) {
        clearTimeout(batch.timeout);
      }
      // Remove from linked-list.
      const newerTopic = batch.newerTopic;
      const olderTopic = batch.olderTopic;
      if (newerTopic) {
        node.batches.get(newerTopic).olderTopic = olderTopic;
      } else { // it's the newest topic
        node.newestTopic = olderTopic;
      }
      if (olderTopic) {
        node.batches.get(olderTopic).newerTopic = newerTopic;
      } else { // it's the oldest topic
        node.oldestTopic = newerTopic;
      }

      node.topicCount--;
      node.batches.delete(topic);

      node.send({
        "topic": topic,
        "payload": batch.payloads
      });
    }

    function flushAllTopics() {
      while (node.oldestTopic) {
        flushTopic(node.oldestTopic);
      }
    }

    this.on("input", function(msg) {
      // Topic is expected to be a string
      const topic = `${msg.topic || ''}`;

      if (msg.payload) {
        // Add msg.payload
        let batch = node.batches.get(topic);
        if (!batch) {
          batch = {
            "payloads": [],
            "olderTopic": node.newestTopic,
            "newerTopic": null
          };
          node.batches.set(topic, batch);
          if (node.maxDelay >= 0) {
            batch.timeout = setTimeout(() => {
              // Safety check - batch object not replaced.
              if (batch === node.batches.get(topic)) {
                delete batch.timeout;
                flushTopic(topic);
              }
            }, node.maxDelay);
          }

          if (node.newestTopic) {
            node.batches.get(node.newestTopic).newerTopic = topic;
          }
          node.newestTopic = topic;

          if (!node.oldestTopic) {
            node.oldestTopic = topic;
          }
          node.topicCount++;

          if (node.topicCount > node.maxTopics) {
            flushTopic(node.oldestTopic);
          }
        }
        batch.payloads.push(msg.payload);
        if (node.batches.get(topic).payloads.length >= node.maxMessagesPerTopic) {
          flushTopic(topic);
        }
      } else {
        // flush topic
        if (topic) {
          flushTopic(topic);
        } else {
          flushAllTopics();
        }
      }
    });

    this.on("close", flushAllTopics);
  });

  RED.nodes.registerType("debouncer", function DebouncerNode(n) {
    RED.nodes.createNode(this,n);
    this.name = n.name;
    this.maxTopics = Math.max(1, parseInt(n.maxTopics) || 0);
    this.interval = (n.interval * 1) || 0;

    this.topicCount = 0;
    this.debounces = new Map();
    // Maintain a linked-list of topics.
    this.oldestTopic = null;
    this.newestTopic = null;

    const node = this;

    function flushTopic(topic) {
      const debounce = node.debounces.get(topic);
      if (!debounce) {
        return;
      }
      if (debounce.timeout) {
        clearTimeout(debounce.timeout);
      }
      // Remove from linked-list.
      const newerTopic = debounce.newerTopic;
      const olderTopic = debounce.olderTopic;
      if (newerTopic) {
        node.debounces.get(newerTopic).olderTopic = olderTopic;
      } else { // it's the newest topic
        node.newestTopic = olderTopic;
      }
      if (olderTopic) {
        node.debounces.get(olderTopic).newerTopic = newerTopic;
      } else { // it's the oldest topic
        node.oldestTopic = newerTopic;
      }

      node.topicCount--;
      node.debounces.delete(topic);

      node.send(debounce.message);
    }

    function flushAllTopics() {
      while (node.oldestTopic) {
        flushTopic(node.oldestTopic);
      }
    }

    this.on("input", function(msg) {
      // Topic is expected to be a string
      const topic = `${msg.topic || ''}`;

      if (msg.payload) {
        // Add msg
        let debounce = node.debounces.get(topic);
        if (!debounce) {
          debounce = {
            "olderTopic": node.newestTopic,
            "newerTopic": null
          };
          node.debounces.set(topic, debounce);
          debounce.timeout = setTimeout(() => {
            // Safety check - debounce object not replaced.
            if (debounce === node.debounces.get(topic)) {
              delete debounce.timeout;
              flushTopic(topic);
            }
          }, node.interval);

          if (node.newestTopic) {
            node.debounces.get(node.newestTopic).newerTopic = topic;
          }
          node.newestTopic = topic;

          if (!node.oldestTopic) {
            node.oldestTopic = topic;
          }
          node.topicCount++;

          if (node.topicCount > node.maxTopics) {
            flushTopic(node.oldestTopic);
          }
        }
        debounce.message = msg;
      } else {
        // flush topic
        if (topic) {
          flushTopic(topic);
        } else {
          flushAllTopics();
        }
      }
    });

    this.on("close", flushAllTopics);
  });

  RED.nodes.registerType("rate-limit", function RateLimitNode(n) {
    RED.nodes.createNode(this,n);
    this.name = n.name;
    this.maxTopics = Math.max(1, parseInt(n.maxTopics) || 0);
    this.maxMessagesPerTopic = Math.max(0, parseInt(n.maxMessagesPerTopic) || 0);
    this.dropOverflowMessages = !!n.dropOverflowMessages;

    this.interval = (n.interval * 1) || 0;

    this.topicCount = 0;
    this.batches = new Map();
    // Maintain a linked-list of topics.
    this.oldestTopic = null;
    this.newestTopic = null;

    const node = this;

    function flushTopic(topic) {
      const batch = node.batches.get(topic);
      if (!batch) {
        return;
      }
      if (batch.interval) {
        clearInterval(batch.interval);
        batch.interval = null;
      }
      // Remove from linked-list.
      const newerTopic = batch.newerTopic;
      const olderTopic = batch.olderTopic;
      if (newerTopic) {
        node.batches.get(newerTopic).olderTopic = olderTopic;
      } else { // it's the newest topic
        node.newestTopic = olderTopic;
      }
      if (olderTopic) {
        node.batches.get(olderTopic).newerTopic = newerTopic;
      } else { // it's the oldest topic
        node.oldestTopic = newerTopic;
      }

      node.topicCount--;
      node.batches.delete(topic);

      batch.messages.forEach(nextMessage => node.send(nextMessage));
    }

    function flushAllTopics() {
      while (node.oldestTopic) {
        flushTopic(node.oldestTopic);
      }
    }

    this.on("input", function(msg) {
      // Topic is expected to be a string
      const topic = `${msg.topic || ''}`;

      if (msg.payload) {
        // Add msg.payload
        let batch = node.batches.get(topic);
        if (batch && (batch.messages.length >= node.maxMessagesPerTopic)) {
          // batch is full
          if (node.dropOverflowMessages) {
            return; // drop message
          }
          flushTopic(topic);
          batch = null;
        }

        if (!batch) {
          batch = {
            "messages": [],
            "olderTopic": node.newestTopic,
            "newerTopic": null
          };
          node.batches.set(topic, batch);
          batch.interval = setInterval(() => {
            // Safety check - batch object not replaced.
            if (batch !== node.batches.get(topic)) {
              if (batch.interval) {
                clearInterval(batch.interval);
              }
              batch.interval = null;
              return;
            }
            if (batch.messages.length > 0) {
              const nextMessage = batch.messages.shift();
              node.send(nextMessage);
              return;
            }
            flushTopic(topic);
          }, node.interval);

          if (node.newestTopic) {
            node.batches.get(node.newestTopic).newerTopic = topic;
          }
          node.newestTopic = topic;

          if (!node.oldestTopic) {
            node.oldestTopic = topic;
          }
          node.topicCount++;

          if (node.topicCount > node.maxTopics) {
            flushTopic(node.oldestTopic);
          }

          node.send(msg);
        } else {
          batch.messages.push(msg);
        }
      } else {
        // flush topic
        if (topic) {
          flushTopic(topic);
        } else {
          flushAllTopics();
        }
      }
    });

    this.on("close", flushAllTopics);

  });

};
