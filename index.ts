import scrapper from './src/Scraper'
import {SCRAPPING_URL} from "./src/config";


scrapper.run(SCRAPPING_URL).then(() =>
    console.log('<> Scraping finished <>')
)
