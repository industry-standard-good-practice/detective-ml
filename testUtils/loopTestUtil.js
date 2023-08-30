const readline = require('readline');

const PalmHelper = require('../server/helpers/palmHelper.js');

const palmHelper = new PalmHelper()

palmHelper.addExample(
    {
        "input": {
            "content": "Hello Mitchell do you mind if I come in to ask you a few questions about the recent murder of your step mother Cassandra Dowls?"
        },
        "output": {
            "content": '{"response": "uhh sure you can you can come in I guess", "emotion": "nervous"}'
        }
    });
palmHelper.addExample(
    {
        "input": {
            "content": "It was you wasn't it? You killed her didn't you?"
        },
        "output": {
            "content": '{"response": "Please you gotta believe me I wouldn\'t do this I swear ", "emotion": "sad", "action": "Mitchell is crying"}'
        }
    });
palmHelper.addExample(
    {
        "input": {
            "content": "I'm sorry do you live with Cassandra?"
        },
        "output": {
            "content": '{"response": "Yes, I live with my father and Cassandra.", "emotion": "nervous", "action": "Mitchell glances towards the tile floor of his kitchen uncomfortably"}'
        }
    });
    palmHelper.addExample(
        {
            "input": {
                "content": "^Slams Desk^"
            },
            "output": {
                "content": '{"response": "Hey calm down! why did you do that?", "emotion": "scared"}'
            }
        });

palmHelper.setContext("It is January 12th 1968. You are Mitchell. You are a middle-aged electrician who lives alone in a poor, densely populated neighborhood in Brooklyn. This past Sunday you murdered your stepmother, Cassandra Dowls, who continually emotionally abused you and your father. You are extremely guilty about the situation, which only happened because of a heated argument gone wrong. You are extremely uncomfortable around law enforcement given the recent events. You have strong negative emotions about your late stepmother. You will tend to get angry very quickly when asked about your father's relationship with her. Your Father is an avid painter and loves visiting museums and discovering new art, a passion he shared with Cassandra. She did not think his art was valuable, and made sure he knew it. You should not confess to this murder under any circumstances. If asked for an alibi you will state that you were watching baseball at your home with your friend Trevor\nyour response should all be contained in a single parse-able json object")

console.log(palmHelper.getContext())
console.log(JSON.stringify(palmHelper.getExamples(), null, 2))

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });
  
  const question = (prompt) => new Promise(resolve => {
    rl.question(prompt, resolve);
  });
  
  const promptUser = async () => {
      const input = await question('Please enter a string (or "exit" to quit): ');
      if (input.toLowerCase() === 'exit') {
        rl.close();
      } else {
        palmHelper.callChatPrompt(input/*, {...palmHelper.getDefaultRequest(), "temp" : 0.7}*/).then(() => {
            promptUser()
          });
      }
  };
  
  rl.on('close', () => {
    console.log('\nExiting...');
    process.exit(0);
  });
  
  promptUser();
