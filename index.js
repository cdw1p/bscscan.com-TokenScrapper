const fetch = require('node-fetch')
const fs = require('fs-extra')
const delay = require('delay')
const moment = require('moment')
const cheerio = require('cheerio')
const cheerioTableparser = require('cheerio-tableparser')
require('colors')

/**
 * Global Variable
 */
let watcherKeyword = ['.finance'], thresholdPrice = '$0 - $1', thresholdHolder = 50
let timeoutTimer = 10000

/**
 * Banner Header
 */
let bannerHeader = `
 _                                                       
| |__  ___  ___ ___  ___ __ _ _ __    ___ ___  _ __ ___  
| '_ \\/ __|/ __/ __|/ __/ _\` | '_ \\  / __/ _ \\| ' \` _  \\ 
| |_) \\__ \\ (__\\__ \\ (_| (_| | | | || (_| (_) | | | | | |
|_.__/|___/\\___|___/\\___\\__,_|_| |_(_)___\\___/|_| |_| |_|

** Shitcoin - Token Tracker and Monitoring by @cdw1p **

++ Bot Configuration
 - Loaded Keyword\t: ${watcherKeyword.length}
 - Threshold Price\t: ${thresholdPrice}
 - Threshold Holder\t: ${thresholdHolder} Address
 - Alert Notification\t: Telegram Channel
`

/**
 * Find BSC Tokens
 */
const functionFindBSCToken = () => new Promise(async (resolve, reject) => {
  try {
    let tempData = []
    let currentPage = 1
    let customPayload = {
      method: 'GET',
      timeout: timeoutTimer,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/90.0.4430.85 Safari/537.36',
      }
    }
    let totalData = cheerio.load(await (await fetch(`https://bscscan.com/tokens?q=${watcherKeyword[0]}&p=1`, customPayload)).text())('#ContentPlaceHolder1_divPagination > ul > li:nth-child(3) > span > strong:nth-child(2)').text()

    for (loop = 1; loop < totalData; loop++) {
      await delay(5 * 1000)
      fetch(`https://bscscan.com/tokens?q=${watcherKeyword}&p=${currentPage}`, customPayload)
      .then(res => res.text())
      .then(result => {
        const $ = cheerio.load(result)
        cheerioTableparser($)
        const dataParse = $('table').parsetable(true, true, true)
        const [ tokenContract, tokenName, tokenSymbol, tokenDecimals, tokenSite ] = dataParse
        for (let index = 0; index < tokenContract.length; index++) {
          tempData.push({
            tokenContract: tokenContract[index],
            tokenName: tokenName[index],
            tokenSymbol: tokenSymbol[index],
            tokenDecimals: tokenDecimals[index],
            tokenSite: tokenSite[index]
          })
        }
        currentPage += 1
      })
    }

    tempData = tempData.filter(data => data.tokenSite.includes('https://'))
    console.log(`(${moment().format('HH:mm:ss')}) Found: ${tempData.length} Data`)
    resolve({ success: true, message: tempData })
  } catch (err) {
    resolve({ success: false, message: err.message })
  }
})

/**
 * Find BSC Info
 */
const functionFindBSCInfo = (tokenData) => new Promise(async (resolve, reject) => {
  try {
    let tempData = []
    let customPayload = {
      method: 'GET',
      timeout: timeoutTimer,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/90.0.4430.85 Safari/537.36',
      }
    }

    for (data of tokenData) {
      const { tokenContract, tokenName, tokenSymbol, tokenDecimals, tokenSite } = data
      fetch(`https://bscscan.com/token/${tokenContract}`, customPayload)
      .then(res => res.text())
      .then(result => {
        const $ = cheerio.load(result)
        const tokenPrice = ($('#ContentPlaceHolder1_tr_valuepertoken > div > div:nth-child(1) > span').text()).split(' @ ')[0].split('$')[1]
        const tokenHolders = $('#ContentPlaceHolder1_tr_tokenHolders > div > div.col-md-8 > div > div').text()
        if (parseFloat(tokenPrice) < thresholdPrice && parseFloat(tokenHolders) > thresholdHolder) {
          console.log(`${`++ Found : ${tokenName} (${tokenSymbol}) - $${tokenPrice}`.green}\n - Contract: ${tokenContract}\n - Website: ${tokenSite}\n - Holder: ${tokenHolders.trim()}\n-`)
          tempData.push({ tokenContract, tokenName, tokenSymbol, tokenDecimals, tokenSite, tokenPrice: `$${tokenPrice}`, tokenHolders: tokenHolders.trim() })
        } else {
          console.log(`${`++ Skipping : ${tokenName} (${tokenSymbol}) - $${tokenPrice}`.yellow}\n - Contract: ${tokenContract}\n - Website: ${tokenSite}\n - Holder: ${tokenHolders.trim()}\n-`)
        }
      })
      await delay(5 * 1000)
    }
    resolve({ success: true, message: tempData })
  } catch (err) {
    resolve({ success: false, message: err.message })
  }
})

/**
 * Main Function
 */
;(async () => {
  try {
    console.log(bannerHeader)
    const resFindBSCToken = await functionFindBSCToken()
    if (resFindBSCToken.success) {
      const resFindBSCInfo = await functionFindBSCInfo(resFindBSCToken.message)
      await fs.writeFileSync('output.json', JSON.stringify(resFindBSCInfo.message, null, 2))
    } else {
      throw new Error(resFindBSCToken.message)
    }
  } catch (err) {
    console.log(`Error: ${err.message}`.red)
  }
})()