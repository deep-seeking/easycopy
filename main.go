package main

import (
	"encoding/json"
	"io/ioutil"
	"log"
	"net/http"
	"os"
	"strconv"
	"strings"
	"sync"
	"time"
)

// 句子结构
type Sentence struct {
	ID        int       `json:"id"`
	Content   string    `json:"content"`
	Group     string    `json:"group"`
	CopyCount int       `json:"copy_count"`
	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`
}

// 数据存储
var sentences []Sentence
var sentenceMutex sync.Mutex
var nextID = 1
var dataFile = "./sentences.json"

func main() {
	// 加载数据
	loadData()
	// 如果没有数据，初始化示例数据
	if len(sentences) == 0 {
		initSampleData()
	}

	// 注册路由处理函数
	http.HandleFunc("/api/sentences", handleSentences)
	http.HandleFunc("/api/sentences/", handleSentenceWithID)
	http.HandleFunc("/", handleRoot)
	http.Handle("/static/", http.StripPrefix("/static/", http.FileServer(http.Dir("./static"))))

	// 启动服务器
	log.Println("服务器启动在 http://localhost:8080")
	if err := http.ListenAndServe(":8080", nil); err != nil {
		log.Fatalf("启动服务器失败: %v", err)
	}
}

// 处理根路径请求
func handleRoot(w http.ResponseWriter, r *http.Request) {
	if r.URL.Path != "/" {
		http.NotFound(w, r)
		return
	}
	http.ServeFile(w, r, "./static/index.html")
}

// 处理获取所有句子和添加句子的请求
func handleSentences(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	w.Header().Set("Access-Control-Allow-Origin", "*")
	w.Header().Set("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
	w.Header().Set("Access-Control-Allow-Headers", "Content-Type")
	
	// 处理预检请求
	if r.Method == "OPTIONS" {
		w.WriteHeader(http.StatusOK)
		return
	}
	
	switch r.Method {
	case "GET":
		getSentences(w, r)
	case "POST":
		addSentence(w, r)
	default:
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
	}
}

// 处理带ID的句子操作
func handleSentenceWithID(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	w.Header().Set("Access-Control-Allow-Origin", "*")
	w.Header().Set("Access-Control-Allow-Methods", "GET, PUT, DELETE, POST, OPTIONS")
	w.Header().Set("Access-Control-Allow-Headers", "Content-Type")
	
	// 处理预检请求
	if r.Method == "OPTIONS" {
		w.WriteHeader(http.StatusOK)
		return
	}
	
	// 解析路径，提取ID和操作类型
	pathParts := strings.Split(strings.TrimPrefix(r.URL.Path, "/api/sentences/"), "/")
	if len(pathParts) < 1 {
		http.Error(w, "无效的路径", http.StatusBadRequest)
		return
	}
	
	// 转换ID为整数
	id, err := strconv.Atoi(pathParts[0])
	if err != nil {
		http.Error(w, "无效的ID", http.StatusBadRequest)
		return
	}
	
	// 处理复制操作
	if len(pathParts) == 2 && pathParts[1] == "copy" && r.Method == "POST" {
		copySentence(w, r, id)
		return
	}
	
	// 处理其他操作
	switch r.Method {
	case "PUT":
		updateSentence(w, r, id)
	case "DELETE":
		deleteSentence(w, r, id)
	default:
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
	}
}

// 初始化示例数据
func initSampleData() {
	sentences = append(sentences, Sentence{
		ID:        nextID,
		Content:   "Hello, this is a sample sentence.",
		Group:     "默认",
		CopyCount: 0,
		CreatedAt: time.Now(),
		UpdatedAt: time.Now(),
	})
	nextID++
	sentences = append(sentences, Sentence{
		ID:        nextID,
		Content:   "This is another example sentence for testing.",
		Group:     "默认",
		CopyCount: 0,
		CreatedAt: time.Now(),
		UpdatedAt: time.Now(),
	})
	nextID++
	// 保存示例数据
	saveData()
}

// 保存数据到文件
func saveData() {
	data, err := json.MarshalIndent(sentences, "", "  ")
	if err != nil {
		log.Printf("保存数据失败: %v", err)
		return
	}

	err = ioutil.WriteFile(dataFile, data, 0644)
	if err != nil {
		log.Printf("写入文件失败: %v", err)
	}
}

// 从文件加载数据
func loadData() {
	if _, err := os.Stat(dataFile); os.IsNotExist(err) {
		// 文件不存在，创建一个空文件
		_, err := os.Create(dataFile)
		if err != nil {
			log.Printf("创建数据文件失败: %v", err)
		}
		return
	}

	data, err := ioutil.ReadFile(dataFile)
	if err != nil {
		log.Printf("读取文件失败: %v", err)
		return
	}

	if len(data) > 0 {
		err = json.Unmarshal(data, &sentences)
		if err != nil {
			log.Printf("解析数据失败: %v", err)
			return
		}

		// 更新nextID
		if len(sentences) > 0 {
			maxID := 0
			for _, s := range sentences {
				if s.ID > maxID {
					maxID = s.ID
				}
			}
			nextID = maxID + 1
		}
	}
}

// 获取句子列表，支持按分组筛选
func getSentences(w http.ResponseWriter, r *http.Request) {
	sentenceMutex.Lock()
	defer sentenceMutex.Unlock()

	// 获取分组参数
	group := r.URL.Query().Get("group")
	var filteredSentences []Sentence

	// 按分组筛选
	if group != "" && group != "全部" {
		for _, s := range sentences {
			if s.Group == group {
				filteredSentences = append(filteredSentences, s)
			}
		}
	} else {
		filteredSentences = sentences
	}

	// 按复制次数排序
	for i := 0; i < len(filteredSentences)-1; i++ {
		for j := 0; j < len(filteredSentences)-i-1; j++ {
			if filteredSentences[j].CopyCount < filteredSentences[j+1].CopyCount {
				filteredSentences[j], filteredSentences[j+1] = filteredSentences[j], filteredSentences[j+1]
			}
		}
	}

	// 返回JSON响应
	json.NewEncoder(w).Encode(filteredSentences)
}

// 添加新句子
func addSentence(w http.ResponseWriter, r *http.Request) {
	var newSentence struct {
		Content string `json:"content"`
		Group   string `json:"group"`
	}

	// 解析请求体
	if err := json.NewDecoder(r.Body).Decode(&newSentence); err != nil {
		http.Error(w, "无效的请求数据: "+err.Error(), http.StatusBadRequest)
		return
	}

	// 验证必填字段
	if newSentence.Content == "" {
		http.Error(w, "内容不能为空", http.StatusBadRequest)
		return
	}

	// 设置默认分组
	if newSentence.Group == "" {
		newSentence.Group = "默认"
	}

	// 创建新句子
	sentenceMutex.Lock()
	defer sentenceMutex.Unlock()
	
	s := Sentence{
		ID:        nextID,
		Content:   newSentence.Content,
		Group:     newSentence.Group,
		CopyCount: 0,
		CreatedAt: time.Now(),
		UpdatedAt: time.Now(),
	}
	sentences = append(sentences, s)
	nextID++

	// 保存数据
	saveData()

	// 返回创建的句子
	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(s)
}

// 删除句子
func deleteSentence(w http.ResponseWriter, r *http.Request, id int) {
	sentenceMutex.Lock()
	defer sentenceMutex.Unlock()

	// 查找并删除句子
	found := false
	for i, s := range sentences {
		if s.ID == id {
			sentences = append(sentences[:i], sentences[i+1:]...)
			found = true
			break
		}
	}

	if !found {
		http.Error(w, "句子不存在", http.StatusNotFound)
		return
	}

	// 保存数据
	saveData()

	// 返回成功消息
	response := map[string]string{"message": "删除成功"}
	json.NewEncoder(w).Encode(response)
}

// 更新句子
func updateSentence(w http.ResponseWriter, r *http.Request, id int) {
	var updateData struct {
		Content string `json:"content"`
		Group   string `json:"group"`
	}

	// 解析请求体
	if err := json.NewDecoder(r.Body).Decode(&updateData); err != nil {
		http.Error(w, "无效的请求数据: "+err.Error(), http.StatusBadRequest)
		return
	}

	// 更新句子
	sentenceMutex.Lock()
	defer sentenceMutex.Unlock()

	found := false
	for i, s := range sentences {
		if s.ID == id {
			if updateData.Content != "" {
				sentences[i].Content = updateData.Content
			}
			if updateData.Group != "" {
				sentences[i].Group = updateData.Group
			}
			sentences[i].UpdatedAt = time.Now()
			found = true
			break
		}
	}

	if !found {
		http.Error(w, "句子不存在", http.StatusNotFound)
		return
	}

	// 保存数据
	saveData()

	// 返回成功消息
	response := map[string]string{"message": "更新成功"}
	json.NewEncoder(w).Encode(response)
}

// 复制句子（增加复制计数）
func copySentence(w http.ResponseWriter, r *http.Request, id int) {
	sentenceMutex.Lock()
	defer sentenceMutex.Unlock()

	// 查找句子并增加复制计数
	var content string
	found := false
	for i, s := range sentences {
		if s.ID == id {
			sentences[i].CopyCount++
			content = s.Content
			found = true
			break
		}
	}

	if !found {
		http.Error(w, "句子不存在", http.StatusNotFound)
		return
	}

	// 保存数据
	saveData()

	// 返回成功消息和复制的内容
	response := map[string]string{
		"message": "复制成功",
		"content": content,
	}
	json.NewEncoder(w).Encode(response)
}