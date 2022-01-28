import axios from 'axios'

class HttpRequest {
    async get(url) {
        const {data} = await axios.get(url)
        return data
    }
}

export default new HttpRequest()
