# API container for docker-compose (matches frontend API_PROXY_TARGET=http://backend:8000).
FROM eclipse-temurin:21-jdk-alpine AS build
WORKDIR /app
COPY gradlew gradlew.bat settings.gradle.kts build.gradle.kts ./
COPY gradle ./gradle
COPY src ./src
RUN chmod +x gradlew && ./gradlew bootJar --no-daemon -x test

FROM eclipse-temurin:21-jre-alpine
WORKDIR /app
RUN addgroup -S app && adduser -S app -G app
RUN mkdir -p /app/uploads && chown -R app:app /app/uploads
COPY --from=build /app/build/libs/*.jar /app/app.jar
USER app
EXPOSE 8000
ENTRYPOINT ["java", "-jar", "/app/app.jar"]
