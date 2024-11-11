# Используем официальный bun образ
FROM jarredsumner/bun:latest

# Рабочая директория внутри контейнера
WORKDIR /app

# Копируем package.json и устанавливаем зависимости
COPY package.json ./
RUN bun install

# Копируем весь проект
COPY . .

# Запускаем проект с параметрами, взятыми из переменных окружения
CMD ["bun", "run", "start"]