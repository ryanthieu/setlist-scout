import { isGetAggregateMessage, isGetOptionsMessage } from "../lib/messages";
import { getOptions } from "../lib/options";
import { getCachedAggregate, setCachedAggregate } from "./aggregate-cache";
import { handleGetAggregate } from "./handle-get-aggregate";

chrome.runtime.onMessage.addListener(
  (message: unknown, _sender, sendResponse) => {
    if (isGetAggregateMessage(message)) {
      handleGetAggregate(message.artist, {
        cacheGet: getCachedAggregate,
        cacheSet: setCachedAggregate,
      }).then(sendResponse);
      return true; // keep the message channel open for the async sendResponse
    }

    if (isGetOptionsMessage(message)) {
      getOptions().then(sendResponse);
      return true;
    }

    return undefined;
  },
);
