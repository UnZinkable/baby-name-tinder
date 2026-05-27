FROM mcr.microsoft.com/dotnet/sdk:8.0 AS build
WORKDIR /src
COPY . .
RUN dotnet publish BabyNameTinder/BabyNameTinder.csproj -c Release -o /app

FROM mcr.microsoft.com/dotnet/aspnet:8.0
WORKDIR /app
COPY --from=build /app .
COPY --from=build /src/BabyNameTinder/wwwroot ./wwwroot
COPY --from=build /src/BabyNameTinder/Data ./Data
ENV ASPNETCORE_URLS=http://+:8080
EXPOSE 8080
ENTRYPOINT ["dotnet", "BabyNameTinder.dll"]
