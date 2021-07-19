const axios = require('axios');

var CFETH = "https://cloudflare-eth.com"

//Change this to the block you want to start on and change useStartingBlock to true
var blockWeAreOn = 0;
//If set to false, the starting block will be the most recently minted block
var useStartingBlock = false

var currentBlock = 100;
var errorarr = [];

const knowncontractaddresses = ['0x7Be8076f4EA4A4AD08075C2508e481d6C946D12b','0xFBeef911Dc5821886e1dda71586d90eD28174B7d'];

start();


/*
This script is designed to start on a certain block number, a given one or the most recently minted block, and download it in order to do computation on it.
I have given an example where you scan each transaction and look at the addresses to see if they are known addresses of contracts/wallets of interest.
 */


//Starting/main function
async function start() {

    await updateBlockNumber();
    await setStartingBlockNumber().then((result) => {
            loopCheckTheNewBlocks();
            loopKeepBlockNumberUpToDate();
        }
    );
}

//Checks to see if there are any new blocks for us to download and if so then it grabs and analyzes them
async function loopCheckTheNewBlocks() {
    while (true) {
        //Gives us a 2 block buffer. Sometimes the number is ahead of the actual blocks that CloudFlare has available. This allows us not to run into a situation where we request a block which they don't have yet
        if (currentBlock > blockWeAreOn + 1) {
            //Grabs X block
            grabBlock(blockWeAreOn).then((result) => {
                //Processes X block
                analyzeBlock(result, true).then((result) => {
                    //Prints out how many known transactions happened on that block. Can be changed to whatever you want it to be/return
                    console.log(result[0].length + " transactions for block " + hexethtoDec(result[1]));
                }).catch((error) => {
                    errorLogger(error[0], error[1])
                });
            }).catch((error) => {
                errorLogger(error[0], error[1])
            });
            //Progresses the next block
            blockWeAreOn++;
        }
        await sleep(1000);
    }
}

async function loopKeepBlockNumberUpToDate() {
    //Infinite loop as the point is not to stop. You can specify your own stopping params if needed
    while (true) {
        updateBlockNumber();

        //10 Seconds wait time. A new ETH block is minted anywhere from 10-20 seconds so this is a good time
        //To short of a time could get you rate limited/blocked from Cloudflare's API so don't spam them
        await sleep(10000);
    }

}

//Simple printing/storing of errors
async function errorLogger(err, blocknumber = 0) {
    console.log(err);
    errorarr.push(err, blocknumber);
}

//Will return if the address is in a known burn address. Expandable to other addresses too.
function burnAddress(address) {
    let burnaddresses = ['0x000000000000000000000000000000000000dead',
        '0x0000000000000000000000000000000000000000'];

    return burnaddresses.includes(address);
}
/*
Returns [From address, to address, what address we recognized ("to" or "from"), the transfer type ("transfer", "burn", "mint"), the transaction value (hex in wei), the blocknumber (in hex)]

This is where you can change what kind of addresses you want to analyze or change up everything if you want to view different parts of the block
 */
async function analyzeBlock(block, distinct = false) {
    return new Promise(((resolve, reject) => {
        addressesofintrest = [];
        addressesthisblockfrom = [];
        addressesthisblockto = [];
        try {
            //console.log(block);
            for (const transaction of block.transactions) {
                let from = transaction.from;
                let to = transaction.to;
                if (knowncontractaddresses.includes(transaction.from)) {

                    let safetopush = true;
                    //Pushes from address, from, value and the block number
                    if (distinct) {
                        if (addressesthisblockfrom.includes(from)) {
                            safetopush = false;
                        }
                    }
                    //If things are safe to push, aka no duplicates if that is enabled
                    if (safetopush) {
                        let transfertype = "transfer";
                        if (burnAddress(to)) {
                            transfertype = "burn";
                        }
                        addressesofintrest.push([from, to, 'from', transfertype, transaction.value, block.number]);
                        addressesthisblockfrom.push(from);
                    }


                }
                if (knowncontractaddresses.includes(transaction.to)) {
                    let safetopush = true;
                    if (distinct) {
                        if (addressesthisblockto.includes(to)) {
                            safetopush = false;
                        }
                    }
                    if (safetopush) {
                        let transfertype = "transfer";
                        if (burnAddress(from)) {
                            transfertype = "mint";
                        }

                        addressesofintrest.push([from, to, 'to', transfertype, transaction.value, block.number]);
                        addressesthisblockto.push(transaction.to);
                    }

                }
            }
            resolve([addressesofintrest, block.number]);
        } catch (e) {
            console.log(e);
            reject([])
        }
    }))
}

//The function that actually grabs the blocks from CloudFlare
async function grabBlock(blocknumber) {
    return new Promise(((resolve, reject) => {
        let hexstring = "0x" + decToHex(blocknumber);
        payload = {"jsonrpc": "2.0", "method": "eth_getBlockByNumber", "params": [hexstring, true], "id": 1}
        axios.post(CFETH, payload).then((response) => {
            resolve(response.data.result);
        }).catch(function (error) {
            console.log(error);
            reject([error, blocknumber]);
        });
    }))
}

//Updates the block number
async function updateBlockNumber() {
    return new Promise((resolve, reject) => {
        evaluateBlockNumber().then(result => {
            currentBlock = result;
            console.log("Latest block " + currentBlock);
            resolve(true);
        }).catch(function (error) {
            reject(error);
            console.log(error);
        })
    })


}


//Resolves a promise of the block number
//Grabs the latest block number from CloudFlare
async function evaluateBlockNumber() {
    return new Promise(((resolve, reject) => {
        payload = {"jsonrpc": "2.0", "method": "eth_blockNumber", "params": [], "id": 1}
        axios.post(CFETH, payload).then((response) => {
            resolve(hexToDec(response.data.result));
        }).catch(function (error) {
            console.log([error]);
            reject(error);
        });
    }))
}

//Updates the starting block to the latest or given block number
async function setStartingBlockNumber() {
    return new Promise(((resolve, reject) => {
        if(!useStartingBlock){
            blockWeAreOn = currentBlock;
        }
        resolve(true);
    }))

}


/*
A set of helper functions
 */

function hexToDec(input) {
    return parseInt(input, 16);
}

function hexethtoDec(input) {
    return parseInt(input.slice(2), 16);
}

function decToHex(input) {
    return input.toString(16)
}

async function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}


