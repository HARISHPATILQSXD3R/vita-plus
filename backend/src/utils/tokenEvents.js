// backend/src/utils/tokenEvents.js
import { EventEmitter } from "events";

export const tokenEvents = new EventEmitter();

// increase default max listeners if many subscribers might appear
tokenEvents.setMaxListeners(50);
