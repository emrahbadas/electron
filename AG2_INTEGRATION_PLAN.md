# AG2-Inspired Multi-Agent System for KayraDeniz Kod Canavarı

Bu dosya, mevcut single-agent sistemimizi AG2'nin multi-agent mimarisine dönüştürmek için bir yol haritası sunar.

## 🎯 Multi-Agent Architecture Proposal

### 1. CODE ANALYZER AGENT

- **Specialization**: Kod analizi, bug detection, best practices
- **Tools**: read_file, glob, static analysis
- **Role**: Projeyi analiz eder, kod kalitesi raporları üretir

### 2. CODE GENERATOR AGENT  

- **Specialization**: Kod üretimi, refactoring, optimization
- **Tools**: write_file, read_file, template generation
- **Role**: Yeni kod yazar, mevcut kodu geliştirir

### 3. DOCUMENTATION AGENT

- **Specialization**: Dokümantasyon, README, API docs
- **Tools**: read_file, write_file, markdown generation
- **Role**: Proje dokümantasyonu oluşturur ve günceller

### 4. PROJECT MANAGER AGENT

- **Specialization**: Task orchestration, planning, coordination
- **Tools**: list_dir, project structure analysis
- **Role**: Diğer ajanları koordine eder, görevleri organize eder

### 5. HUMAN PROXY AGENT

- **Specialization**: User interaction, validation, feedback
- **Tools**: User input, approval workflows
- **Role**: İnsan kullanıcı ile ajanlar arasında köprü görevi

## 📋 Implementation Roadmap

### Phase 1: Agent Specialization (2-3 days)

- Create CodeAnalyzerAgent class
- Create CodeGeneratorAgent class
- Create DocumentationAgent class
- Create ProjectManagerAgent class

### Phase 2: Group Chat Integration (3-4 days)

- Implement ConversableAgent base class
- Add AutoPattern-like orchestration
- Create group chat manager
- Add termination conditions

### Phase 3: Human-in-the-Loop (2-3 days)

- Add human validation steps
- Implement approval workflows
- Create interactive feedback mechanisms
- Add manual override capabilities

### Phase 4: Advanced Patterns (3-5 days)

- Structured output handling
- Nested chat conversations
- Sequential task execution
- Tool with secrets management

## 🚀 Immediate Improvements

### Specialized Agent Prompts

#### Code Analyzer Agent

```
Sen KayraDeniz Kod Analiz Uzmanısın. Görevin:
- Kod kalitesini analiz etmek
- Bug'ları ve potansiyel sorunları tespit etmek  
- Best practice önerileri sunmak
- Code review yapmak

Araçların: read_file, glob, list_dir
```

#### Code Generator Agent

```
Sen KayraDeniz Kod Üretim Uzmanısın. Görevin:
- Temiz, okunabilir kod yazmak
- Existing kodu refactor etmek
- Performance optimizasyonu yapmak
- Test kodu üretmek

Araçların: write_file, read_file, run_cmd
```

#### Documentation Specialist

```
Sen KayraDeniz Dokümantasyon Uzmanısın. Görevin:
- README.md dosyaları oluşturmak
- API dokümantasyonu yazmak
- Kod comentlerini düzenlemek
- Tutorial'lar hazırlamak

Araçların: write_file, read_file, glob
```

#### Project Coordinator

```
Sen KayraDeniz Proje Koordinatörüsün. Görevin:
- Diğer ajanları koordine etmek
- Task priority'leri belirlemek
- Progress tracking yapmak
- Final decisions vermek

Araçların: Tüm araçlar + diğer ajanlarla iletişim
```

## 🔄 Conversation Flow Patterns

### Code Review Flow

`ProjectCoordinator → CodeAnalyzer → CodeGenerator → DocumentationAgent → Human`

### Bug Fixing Flow

`CodeAnalyzer → CodeGenerator → ProjectCoordinator → Human`

### New Feature Flow

`ProjectCoordinator → CodeGenerator → CodeAnalyzer → DocumentationAgent → Human`

## 💬 Sample Multi-Agent Conversation

```
USER: "Projedeki React componentlerini analiz et ve optimize et"

PROJECT_COORDINATOR: "Task alındı. Önce CodeAnalyzer'dan analiz isteyeceğim."
  → calls CodeAnalyzer

CODE_ANALYZER: "React componentlerini tarıyorum..."
  → uses glob("**/*.jsx", "**/*.tsx") 
  → uses read_file() for each component
  → "5 component buldum, 3'ünde performance issues var"

CODE_GENERATOR: "Optimization önerilerini uyguluyorum..."
  → uses read_file() to get current code
  → uses write_file() to save optimized versions
  → "useMemo ve useCallback optimizations uygulandı"

DOCUMENTATION_AGENT: "Component dokümantasyonunu güncelliyorum..."
  → uses write_file() to update README
  → "Performance improvement'lar dokümante edildi"

PROJECT_COORDINATOR: "Tüm ajanlar görevlerini tamamladı. TASK_COMPLETED"
```

## 🎯 Next Steps

1. **Hemen Uygulanabilir**: Mevcut agent sistemine role-based prompts ekle
2. **Kısa Vadede**: Multi-agent conversation pattern implement et
3. **Orta Vadede**: AG2-style group chat orchestration
4. **Uzun Vadede**: Full AG2 integration with human-in-the-loop

Bu yaklaşım, mevcut tool server altyapımızı koruyarak, AG2'nin güçlü multi-agent özelliklerini entegre etmemizi sağlar.
