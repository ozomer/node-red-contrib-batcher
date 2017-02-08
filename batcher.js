/* jshint esversion: 6 */
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

    var node = this;

    function flushTopic(topic) {
      var batch = node.batches.get(topic);
      if (!batch) {
        return;
      }
      if (!!batch.timeout) {
        clearTimeout(batch.timeout);
      }
      // Remove from linked-list.
      var newerTopic = batch.newerTopic;
      var olderTopic = batch.olderTopic;
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
        "topic": topic.slice(1), // remove '#'
        "payload": batch.payloads
      });
    }

    function flushAllTopics() {
      while (node.oldestTopic) {
        flushTopic(node.oldestTopic);
      }
    }

    this.on("input", function(msg) {
      // Save topics with a leading '#' to avoid javascript internals
      // (for example, a topic named "hasOwnProperty").
      // Also avoids treating empty strings as false values.
      var topic = '' + ((msg.topic)?(msg.topic):'');

      if (msg.payload) {
        // Add msg.payload
        var batch = node.batches.get(topic);
        if (!batch) {
          batch = {
            "payloads": [],
            "olderTopic": node.newestTopic,
            "newerTopic": null
          };
          node.batches.set(topic, batch);
          if (node.maxDelay >= 0) {
            batch.timeout = setTimeout(function() {
              // Safety check - batch object not replaced.
              if (batch == node.batches.get(topic)) {
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
        if (!!topic) {
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

    var node = this;

    function flushTopic(topic) {
      var debounce = node.debounces.get(topic);
      if (!debounce) {
        return;
      }
      if (!!debounce.timeout) {
        clearTimeout(debounce.timeout);
      }
      // Remove from linked-list.
      var newerTopic = debounce.newerTopic;
      var olderTopic = debounce.olderTopic;
      if (newerTopic) {
        node.debounces(newerTopic).olderTopic = olderTopic;
      } else { // it's the newest topic
        node.newestTopic = olderTopic;
      }
      if (olderTopic) {
        node.debounces(olderTopic).newerTopic = newerTopic;
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
      // Save topics with a leading '#' to avoid javascript internals
      // (for example, a topic named "hasOwnProperty").
      // Also avoids treating empty strings as false values.
      var topic = '' + ((msg.topic)?(msg.topic):'');

      if (msg.payload) {
        // Add msg
        var debounce = node.debounces.get(topic);
        if (!debounce) {
          debounce = {
            "olderTopic": node.newestTopic,
            "newerTopic": null
          };
          node.debounces.set(topic, debounce);
          debounce.timeout = setTimeout(function() {
            // Safety check - debounce object not replaced.
            if (debounce == node.debounces.get(topic)) {
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
        if (!!topic) {
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

  RED.nodes.registerType("rate-limit", function RateLimitNode(n) {
    RED.nodes.createNode(this,n);
    this.name = n.name;
    this.maxTopics = Math.max(1, parseInt(n.maxTopics) || 0);
    this.maxMessagesPerTopic = Math.max(1, parseInt(n.maxMessagesPerTopic) || 0);
    this.interval = (n.interval * 1) || 0;

    this.topicCount = 0;
    this.batches = new Map();
    // Maintain a linked-list of topics.
    this.oldestTopic = null;
    this.newestTopic = null;

    var node = this;

    function flushTopic(topic) {
      var batch = node.batches.get(topic);
      if (!batch) {
        return;
      }
      if (!!batch.interval) {
        clearInterval(batch.iterval);
        batch.interval = null;
      }
      // Remove from linked-list.
      var newerTopic = batch.newerTopic;
      var olderTopic = batch.olderTopic;
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

      batch.messages.forEach(function(nextMessage) {
        node.send(nextMessage);
      });
    }

    function flushAllTopics() {
      while (node.oldestTopic) {
        flushTopic(node.oldestTopic);
      }
    }

    this.on("input", function(msg) {
      // Save topics with a leading '#' to avoid javascript internals
      // (for example, a topic named "hasOwnProperty").
      // Also avoids treating empty strings as false values.
      var topic = '' + ((msg.topic)?(msg.topic):'');

      if (msg.payload) {
        // Add msg.payload
        var batch = node.batches.get(topic);
        if (!batch) {
          batch = {
            "messages": [],
            "olderTopic": node.newestTopic,
            "newerTopic": null
          };
          node.batches.set(topic, batch);
          batch.interval = setInterval(function() {
            // Safety check - batch object not replaced.
            if (batch != node.batches.get(topic)) {
              if (!!batch.interval) {
                clearInterval(batch.interval);
              }
              batch.interval = null;
              return;
            }
            if (batch.messages.length > 0) {
              var nextMessage = batch.messages.shift();
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
        }
        batch.messages.push(msg);
        if (node.batches.get(topic).messages.length >= node.maxMessagesPerTopic) {
          flushTopic(topic);
        }
      } else {
        // flush topic
        if (!!topic) {
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
