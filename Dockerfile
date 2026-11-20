FROM python:3.12-alpine
WORKDIR /app
COPY model.py store.py server.py ./
COPY static ./static
RUN mkdir -p /app/data
ENV PORT=8000 INTEGRITY_HOST=0.0.0.0
EXPOSE 8000
CMD ["python", "server.py"]
