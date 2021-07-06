# win-ngnt-smartcontract
This is the Win NGNT repo. This is implementation is built for the Binance Smart Chain.

# Test
Tests are done on a fork of the main Binance Smart Chain. To test, replace `buyer` in [params.json](https://github.com/nonseodion/win-ngnt/blob/master/test/utils/params.json) and in the following with an address with a very large NGNT balance on BSC mainnet (0xef7d1352c49a1DE2E0cea1CAa644032238e0f5AF had a sufficient balance at the time of writing this) and run 
` ganache-cli --fork https://bsc-dataseed.binance.org -u buyer -a 30 `

` truffle test test/winNgnt.test.js `