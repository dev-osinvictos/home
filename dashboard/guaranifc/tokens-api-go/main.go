package main

import (
	"log"
	"net/http"
	"os"
	"database/sql"
	"tokens-api-go/db"
	"tokens-api-go/api"
)

type App struct {
	DB *sql.DB
}

func Init() {
	dsn := os.Getenv("DATABASE_URL")

	if dsn == "" {
		log.Fatal("❌ ERROR: DATABASE_URL is empty. Did you export it?")
	}

	var err error
	db.DB, err = sql.Open("pgx", dsn)
	if err != nil {
		log.Fatal("DB init error:", err)
	}

	if err := db.DB.Ping(); err != nil {
		log.Fatal("❌ DB unreachable:", err)
	}

	log.Println("🟢 DATABASE CONNECTED SUCCESSFULLY!")
}

func main() {
	db.Init()
	
	mux := http.NewServeMux()
	mux.HandleFunc("/api/wallet/link", api.HandleWalletLink)
	mux.HandleFunc("/api/tokens/mint-from-goals", api.HandleMintFromGoals)
	mux.HandleFunc("/api/me/balance", api.HandleMyBalance)
	mux.HandleFunc("/api/plans", api.HandlePlans)
	mux.HandleFunc("/api/subscribe", api.HandleSubscribe)
	mux.HandleFunc("/api/market", api.HandleMarketList)
	mux.HandleFunc("/api/market/list", api.HandleMarketCreate)
	mux.HandleFunc("/api/market/buy", api.HandleMarketBuy)

	addr := ":8080"
	log.Println("🟢 GOLS Tokens API rodando em", addr)
	http.ListenAndServe(addr, corsMiddleware(mux))
}

func corsMiddleware(next http.Handler) http.Handler {
    return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
        origin := r.Header.Get("Origin")

        // Liberar somente durante DEV:
        if origin == "http://127.0.0.1:8081" || origin == "http://localhost:8081" {
            w.Header().Set("Access-Control-Allow-Origin", origin)
        } else {
            w.Header().Set("Access-Control-Allow-Origin", "https://www.osinvictos.com.br")
        }

        w.Header().Set("Access-Control-Allow-Methods", "GET,POST,OPTIONS")
        w.Header().Set("Access-Control-Allow-Headers", "Content-Type,Authorization")
        w.Header().Set("Access-Control-Allow-Credentials", "true")

        if r.Method == http.MethodOptions {
            w.WriteHeader(http.StatusNoContent)
            return
        }
        next.ServeHTTP(w, r)
    })
}

