import ky from "ky"


const kyInstance = ky.create({
    credentials: "include", // Envoyer les cookies avec chaque requête
    parseJson: (text) => JSON.parse(text, (key, value) => {
        if (key.endsWith("At")) {
            return new Date(value)
        }
        return value
    }),
})

export default kyInstance