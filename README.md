# node-red-contrib-batcher
Node-RED node that collects sequences of payloads and send them in a single message.


Collects message payloads by topic and sends them in a batch (array) when:

* The number of messages in the given topic reaches the configured maximal value.
* The number of unique topics in cache crosses the configured limit (flushes the topic of the oldest message in the cache).
* A message with a non-true payload (false, null, undefined, empty-string...) arrives. If the topic is non-true, all the cache will be flushed, otherwise only the given topic will be flushed.
* The oldest message in cache of a given topic waits for more than the maximal delay time (use a negative value to disable feature).

New in version 0.1:

* Debouncer Node. Very similar to the batcher node, but saves and sends only the latest message.

New in version 0.2:

* Using Maps instead of objects.
* Rate-Limit Node. Limit the rate of messages per topic.
