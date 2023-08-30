const { GoogleAuth } = require("google-auth-library");
const { DiscussServiceClient } = require("@google-ai/generativelanguage");

const PalmHelper = class {
    constructor(priming = null) {
      this.context = priming?.context || '';
      this.examples = priming?.examples || [];
      this.messages = priming?.messages || [];
      this.defaultRequest = {
        "context": this.context,
        "examples" : this.examples,
        "messages" : this.messages,
        "temp" : 0.25,
        "model" : "models/chat-bison-001"
      }
      this.client = new DiscussServiceClient({
        authClient: new GoogleAuth().fromAPIKey(process.env.PALM_KEY),
      });
    }

    addExample(example) {
      this.examples.push(example);
    }

    addExamples(examples){
      this.examples.push(examples)
    }

    addMessage(message) {
      //console.log(message)
      this.messages.push({
        "content": message
      });
    }

    setContext(context){
      this.context = context
    }

    getContext() {
      return this.context;
    }

    getDefaultRequest() {
      return this.defaultRequest;
    }

    getExamples() {
      return this.examples;
    }

    getMessages() {
      return this.messages;
    }

    callChatPrompt(message, request = this.defaultRequest){
      this.addMessage(message)
      return this.client.generateMessage({
        // required, which model to use to generate the result
        model: request.model,
        // optional, 0.0 always uses the highest-probability result
        temperature: request.temp,
        // optional, how many candidate results to generate
        candidateCount: 1,
        // optional, number of most probable tokens to consider for generation
        top_k: 40,
        // optional, for nucleus sampling decoding strategy
        top_p: 0.95,
        prompt: {
          // optional, sent on every request and prioritized over history
          context: request.context,
          // optional, examples to further finetune responses
          examples: request.examples,
          // required, alternating prompt/response messages
          messages: request.messages
        },
      }).then(result => {
        console.log(JSON.parse(result[0].candidates[0].content))
        this.addMessage(result[0].candidates[0].content)
        return JSON.parse(result[0].candidates[0].content)
      });
    }
  };

module.exports = PalmHelper;