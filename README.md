# node-red-contrib-chunkifier
Node-RED node that collects sequences of payloads and send them in a single message.


Collects message payloads by topic and sends them in chunk (array) when:

* The number of messages in the given topic reaches the configured maximal value.
* The number of unique topics in cache crosses the configured limit (flushes the topic of the oldest message in the cache).
* A message with a non-true payload (false, null, undefined, empty-string...) arrives. If the topic is non-true, all the cache will be flushed, otherwise only the given topic will be flushed.
* The oldest message in cache of a given topic waits for more than the maximal delay time (use a negative value to disable feature).
