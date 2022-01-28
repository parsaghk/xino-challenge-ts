import axios from 'axios'
import fs from 'fs';
import cheerio from 'cheerio'
import _ from "lodash";

const ROOT_PATH = process.env.PWD

function normalizeValue(cheerioProperty) {
    return _.camelCase(cheerioProperty.clone().children()
        .remove()
        .end()
        .text())
}

function removingWhiteSpaceCharacters(input: string) {
    return input.replace(/\t|\n/g, '')
}

async function findDetail(url) {
    const {data} = await axios(url)
    const $ = cheerio.load(data)
    const details: any = {}
    $('.half-day-card.content-module ').each((cardIndex, card) => {
        const cheerioCard = $(card)
        const cardTitle = cheerioCard.find('.title').text()
        const cardDescription = cheerioCard.find('.phrase').text()
        const cardIconPath = cheerioCard.find('img').attr('src')
        const cardPanel = cheerioCard.find('.panels')
        const sideList = $(cardPanel).children()
        const detailsBasedOnPanel = {}
        $(sideList).each((sideIndex, side: any) => {

            const itemList = $(side).children()
            $(itemList).each((itemIndex, item) => {
                const cheerioItem = $(item)
                const property = cheerioItem.children()[0]
                detailsBasedOnPanel[normalizeValue(cheerioItem)] = $(property).text()

            })
        })
        details[cardTitle] = {description: cardDescription, iconPath: cardIconPath, ...detailsBasedOnPanel}
    })
    const SunriseOrSunset = {}
    $('.sunrise-sunset .panel').each((panelIndex, panel) => {
        const cheerioPanel = $(panel)
        const [duration, rising, falling] = cheerioPanel.find('.spaced-content')
        const [hours, minutes] = $(duration).find('.duration-time')
        const risingTime = $(rising).find('.text-value').text()
        const fallingTime = $(falling).find('.text-value').text()
        SunriseOrSunset[panelIndex === 0 ? 'Sun' : 'Moon'] = {
            duration: `${normalizeValue($(hours))} ${normalizeValue($(minutes))}`,
            risingTime,
            fallingTime
        }

    })
    details.SunriseOrSunset = SunriseOrSunset


    const temperatureHistory = {}
    $('.history .row').each((rowIndex, row) => {
        const cheerioRow = $(row)
        const label = cheerioRow.find('.label').text()
        const [low, high] = cheerioRow.find('.temperature')
        temperatureHistory[_.camelCase(label)] = {low: $(low).text(), high: $(high).text()}
    })
    details.temperatureHistory = temperatureHistory
    return details

}

async function apiCall(url: string) {
    const {origin} = new URL(url)
    const {data} = await axios(url)
    const $ = cheerio.load(data)
    const promiseArray: any[] = []
    const month = $('body > div > div.two-column-page-content > div.page-column-1 > div.content-module > div.monthly-tools.non-ad > div.monthly-dropdowns > div:nth-child(1) > div.map-dropdown-toggle > h2').text()
    $('a.monthly-daypanel').each((i, el) => {
        const path = el.attribs.href
        const cheerioElement = $(el)
        const day = ($(cheerioElement.find('.date')[0]).text())
        const low = ($(cheerioElement.find('.high')[0]).text())
        const high = ($(cheerioElement.find('.low')[0]).text())
        promiseArray.push({
            day: removingWhiteSpaceCharacters(day),
            low: removingWhiteSpaceCharacters(low),
            high: removingWhiteSpaceCharacters(high),
            link: `${origin}/${path}`
        })
    })
    const result = await Promise.all(promiseArray.map(async day => {
        day.details = await findDetail(day.link)
        return day
    }))
    fs.writeFileSync(`${ROOT_PATH}/test.json`, JSON.stringify({[month]: result}, null, 4))
}

const url = 'https://www.accuweather.com/en/gb/london/ec4a-2/february-weather/328328?year=2022'
apiCall(url).then(() =>
    console.log('<> Scraping finished <>')
)
