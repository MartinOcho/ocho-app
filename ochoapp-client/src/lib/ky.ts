import ky from "ky"


const kyInstance = ky.create({
    parseJson: (text) => JSON.parse(text, (key, value) => {
        if (
            key.endsWith("At") &&
            (typeof value === "string" || typeof value === "number") &&
            value !== ""
        ) {
            const date = new Date(value)
            if (!Number.isNaN(date.getTime())) {
                return date
            }
        }
        return value
    }),
})

export default kyInstance