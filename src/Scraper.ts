import _ from 'lodash';
import cheerio, {CheerioAPI} from 'cheerio';
import httpRequest from './HttpRequest';
import {ROOT_PATH} from './config';
import fs from "fs";

class Scraper {
    getHtmlTagTextWithoutChildren(cheerioProperty) {
        return _.camelCase(cheerioProperty.clone().children()
            .remove()
            .end()
            .text())
    }

    removeInappropriateDays(arr: any[]) {
        const indexList: number[] = []
        for (let i = 1; i < arr.length; i++) {
            const currentItem = arr[i]
            const prevItem = arr[i - 1]
            if (parseInt(prevItem.day) > parseInt(currentItem.day))
                indexList.push(i)

        }
        return (arr.slice(indexList[0], indexList[1]))
    }

    removingWhiteSpaceCharacters(input: string) {
        return input.replace(/\t|\n/g, '')
    }

    private findDayAndNightData($: CheerioAPI) {
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
                    detailsBasedOnPanel[this.getHtmlTagTextWithoutChildren(cheerioItem)] = $(property).text()

                })
            })
            details[cardTitle] = {description: cardDescription, iconPath: cardIconPath, ...detailsBasedOnPanel}
        })
        return details
    }

    private findSunriseAndSunsetData($: CheerioAPI) {
        const SunriseAndSunset = {}
        $('.sunrise-sunset .panel').each((panelIndex, panel) => {
            const cheerioPanel = $(panel)
            const [duration, rising, falling] = cheerioPanel.find('.spaced-content')
            const [hours, minutes] = $(duration).find('.duration-time')
            const risingTime = $(rising).find('.text-value').text()
            const fallingTime = $(falling).find('.text-value').text()
            SunriseAndSunset[panelIndex === 0 ? 'Sun' : 'Moon'] = {
                duration: `${this.getHtmlTagTextWithoutChildren($(hours))} ${this.getHtmlTagTextWithoutChildren($(minutes))}`,
                risingTime,
                fallingTime
            }

        })
        return SunriseAndSunset
    }

    private findTemperatureData($: CheerioAPI) {
        const temperatureHistory = {}
        $('.history .row').each((rowIndex, row) => {
            const cheerioRow = $(row)
            const label = cheerioRow.find('.label').text()
            const [low, high] = cheerioRow.find('.temperature')
            temperatureHistory[_.camelCase(label)] = {low: $(low).text(), high: $(high).text()}
        })
        return temperatureHistory
    }

    async findDetail(url: string) {
        const data = await httpRequest.get(url)
        const $ = cheerio.load(data)
        const details = this.findDayAndNightData($)
        details.SunriseOrSunset = this.findSunriseAndSunsetData($)
        details.temperatureHistory = this.findTemperatureData($)
        return details
    }

    async run(url: string) {
        const {origin} = new URL(url)
        const data = await httpRequest.get(url)
        const $ = cheerio.load(data)
        const promiseArray: any[] = []
        const month = $('div.monthly-dropdowns > div:nth-child(1) > div.map-dropdown-toggle > h2').text()
        const year = $('div.monthly-dropdowns > div:nth-child(2) > div.map-dropdown-toggle > h2').text()
        $('a.monthly-daypanel').each((i, el) => {
            const path = el.attribs.href
            const cheerioElement = $(el)
            const day = ($(cheerioElement.find('.date')[0]).text())
            const low = ($(cheerioElement.find('.high')[0]).text())
            const high = ($(cheerioElement.find('.low')[0]).text())
            promiseArray.push({
                day: this.removingWhiteSpaceCharacters(day),
                low: this.removingWhiteSpaceCharacters(low),
                high: this.removingWhiteSpaceCharacters(high),
                link: `${origin}${path}`
            })
        })
        const result = await Promise.all(this.removeInappropriateDays(promiseArray).map(async day => {
            day.details = await this.findDetail(day.link)
            return day
        }))

        fs.writeFileSync(`${ROOT_PATH}/output.json`, JSON.stringify({[year]: {[month]: result}}, null, 4))
    }
}

export default new Scraper()
