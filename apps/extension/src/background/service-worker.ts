import { isGetAggregateMessage } from "../lib/messages";
import { getCachedAggregate, setCachedAggregate } from "./aggregate-cache";
import { handleGetAggregate } from "./handle-get-aggregate";

chrome.runtime.onMessage.addListener(
  (message: unknown, _sender, sendResponse) => {
    if (!isGetAggregateMessage(message)) return undefined;

    handleGetAggregate(message.artist, {
      cacheGet: getCachedAggregate,
      cacheSet: setCachedAggregate,
    }).then(sendResponse);

    return true; // keep the message channel open for the async sendResponse
  },
);
