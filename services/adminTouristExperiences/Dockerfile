
FROM node:18

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .

EXPOSE 3009

CMD ["node", "TouristExperiencesService.js"]
