import { eveChannel } from "eve/channels/eve";
import { chatAuth } from "../../src/core/auth/chat-auth";

export default eveChannel({ auth: chatAuth });
