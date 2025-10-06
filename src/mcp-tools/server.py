#!/usr/bin/env python3
"""
KayraDeniz Electron App için Basit JSON-RPC Server
Dosya işlemleri ve kod üretimi için gerekli tools
GitHub entegrasyonu ve kod agent sistemi
"""
import json
import os
import sys
import subprocess
from typing import Any, Callable, Dict, List, Optional, cast

import requests

class KayradenizToolServer:
    def __init__(self):
        self.github_token: Optional[str] = None
        self.github_api_base: str = "https://api.github.com"
        self.git_user_name: Optional[str] = None
        self.git_user_email: Optional[str] = None
        
        self.tools: Dict[str, Callable[[Dict[str, Any]], str]] = {
            "hello_world": self.hello_world,
            "create_file": self.create_file,
            "read_file": self.read_file,
            "list_files": self.list_files,
            "write_code": self.write_code,
            "generate_project_structure": self.generate_project_structure,
            "set_github_token": self.set_github_token,
            "github_clone": self.github_clone,
            "github_status": self.github_status,
            "github_commit": self.github_commit,
            "github_push": self.github_push,
            "github_create_repo": self.github_create_repo,
            "github_search_code": self.github_search_code,
            "github_create_gist": self.github_create_gist,
            "github_create_issue": self.github_create_issue,
            "git_init": self.git_init,
            "git_add": self.git_add,
            "git_commit": self.git_commit,
            "git_push": self.git_push,
            "git_pull": self.git_pull,
            "git_branch": self.git_branch,
            "code_agent_analyze": self.code_agent_analyze,
            "code_agent_edit": self.code_agent_edit,
            "code_agent_refactor": self.code_agent_refactor
        }

    @staticmethod
    def _get_required_str(args: Dict[str, Any], key: str) -> str:
        value = args.get(key)
        if value is None:
            raise ValueError(f"Missing required argument: {key}")
        return str(value)

    @staticmethod
    def _get_optional_str(args: Dict[str, Any], key: str) -> Optional[str]:
        value = args.get(key)
        return str(value) if value is not None else None

    @staticmethod
    def _get_bool(args: Dict[str, Any], key: str, default: bool) -> bool:
        return bool(args.get(key, default))

    @staticmethod
    def _resolve_path(path: str, working_directory: Optional[str]) -> str:
        if working_directory and not os.path.isabs(path):
            return os.path.join(working_directory, path)
        return path

    @staticmethod
    def _run_subprocess(cmd: List[str], cwd: Optional[str] = None) -> subprocess.CompletedProcess[str]:
        return subprocess.run(cmd, cwd=cwd, capture_output=True, text=True)

    def get_tool_descriptions(self) -> Dict[str, Dict[str, Any]]:
        """Tools açıklamaları"""
        return {
            "hello_world": {
                "name": "hello_world",
                "description": "Test amaçlı basit merhaba mesajı",
                "inputSchema": {
                    "type": "object",
                    "properties": {
                        "message": {
                            "type": "string",
                            "description": "Göndermek istediğin mesaj"
                        }
                    },
                    "required": ["message"]
                }
            },
            "create_file": {
                "name": "create_file",
                "description": "Yeni dosya oluştur ve içeriğini yaz",
                "inputSchema": {
                    "type": "object",
                    "properties": {
                        "file_path": {
                            "type": "string",
                            "description": "Oluşturulacak dosyanın yolu"
                        },
                        "content": {
                            "type": "string", 
                            "description": "Dosyaya yazılacak içerik"
                        }
                    },
                    "required": ["file_path", "content"]
                }
            },
            "read_file": {
                "name": "read_file",
                "description": "Dosya içeriğini oku",
                "inputSchema": {
                    "type": "object",
                    "properties": {
                        "file_path": {
                            "type": "string",
                            "description": "Okunacak dosyanın yolu"
                        }
                    },
                    "required": ["file_path"]
                }
            },
            "list_files": {
                "name": "list_files",
                "description": "Dizindeki dosyaları listele",
                "inputSchema": {
                    "type": "object",
                    "properties": {
                        "directory_path": {
                            "type": "string",
                            "description": "Listelenecek dizinin yolu",
                            "default": "."
                        }
                    }
                }
            },
            "write_code": {
                "name": "write_code",
                "description": "Kod dosyası oluştur (HTML, CSS, JS, Python vb.)",
                "inputSchema": {
                    "type": "object",
                    "properties": {
                        "file_path": {
                            "type": "string",
                            "description": "Kod dosyasının yolu"
                        },
                        "content": {
                            "type": "string",
                            "description": "Kod içeriği"
                        },
                        "language": {
                            "type": "string",
                            "description": "Programlama dili (html, css, js, python, etc.)",
                            "default": "text"
                        }
                    },
                    "required": ["file_path", "content"]
                }
            },
            "generate_project_structure": {
                "name": "generate_project_structure",
                "description": "Proje klasör yapısı oluştur",
                "inputSchema": {
                    "type": "object",
                    "properties": {
                        "project_name": {
                            "type": "string",
                            "description": "Proje adı"
                        },
                        "project_type": {
                            "type": "string",
                            "description": "Proje tipi (web, desktop, mobile, etc.)",
                            "default": "web"
                        },
                        "base_path": {
                            "type": "string",
                            "description": "Proje oluşturulacak temel yol",
                            "default": "."
                        }
                    },
                    "required": ["project_name"]
                }
            },
            "set_github_token": {
                "name": "set_github_token",
                "description": "GitHub Fine-grained personal access token ayarla",
                "inputSchema": {
                    "type": "object",
                    "properties": {
                        "token": {
                            "type": "string",
                            "description": "GitHub Fine-grained personal access token"
                        },
                        "git_user_name": {
                            "type": "string",
                            "description": "Git commit için kullanıcı adı"
                        },
                        "git_user_email": {
                            "type": "string",
                            "description": "Git commit için email"
                        }
                    },
                    "required": ["token"]
                }
            },
            "github_clone": {
                "name": "github_clone",
                "description": "GitHub repository clone et",
                "inputSchema": {
                    "type": "object",
                    "properties": {
                        "repo_url": {
                            "type": "string",
                            "description": "GitHub repository URL"
                        },
                        "target_dir": {
                            "type": "string",
                            "description": "Hedef dizin",
                            "default": "./cloned-repo"
                        }
                    },
                    "required": ["repo_url"]
                }
            },
            "github_create_repo": {
                "name": "github_create_repo",
                "description": "GitHub'da yeni repository oluştur",
                "inputSchema": {
                    "type": "object",
                    "properties": {
                        "name": {
                            "type": "string",
                            "description": "Repository adı"
                        },
                        "description": {
                            "type": "string",
                            "description": "Repository açıklaması"
                        },
                        "private": {
                            "type": "boolean",
                            "description": "Private repository",
                            "default": False
                        }
                    },
                    "required": ["name"]
                }
            },
            "github_search_code": {
                "name": "github_search_code",
                "description": "GitHub'da kod ara",
                "inputSchema": {
                    "type": "object",
                    "properties": {
                        "query": {
                            "type": "string",
                            "description": "Arama sorgusu"
                        }
                    },
                    "required": ["query"]
                }
            },
            "github_create_gist": {
                "name": "github_create_gist",
                "description": "GitHub Gist oluştur ve paylaş",
                "inputSchema": {
                    "type": "object",
                    "properties": {
                        "filename": {
                            "type": "string",
                            "description": "Dosya adı"
                        },
                        "content": {
                            "type": "string",
                            "description": "Dosya içeriği"
                        },
                        "description": {
                            "type": "string",
                            "description": "Gist açıklaması",
                            "default": "KayraDeniz Code Snippet"
                        },
                        "public": {
                            "type": "boolean",
                            "description": "Public gist",
                            "default": True
                        }
                    },
                    "required": ["filename", "content"]
                }
            },
            "github_create_issue": {
                "name": "github_create_issue",
                "description": "GitHub Issue oluştur",
                "inputSchema": {
                    "type": "object",
                    "properties": {
                        "owner": {
                            "type": "string",
                            "description": "Repository sahibi"
                        },
                        "repo": {
                            "type": "string",
                            "description": "Repository adı"
                        },
                        "title": {
                            "type": "string",
                            "description": "Issue başlığı"
                        },
                        "body": {
                            "type": "string",
                            "description": "Issue içeriği"
                        }
                    },
                    "required": ["owner", "repo", "title"]
                }
            },
            "git_init": {
                "name": "git_init",
                "description": "Git repository başlat",
                "inputSchema": {
                    "type": "object",
                    "properties": {
                        "repo_path": {
                            "type": "string",
                            "description": "Repository yolu",
                            "default": "."
                        }
                    }
                }
            },
            "git_add": {
                "name": "git_add",
                "description": "Git add işlemi",
                "inputSchema": {
                    "type": "object",
                    "properties": {
                        "files": {
                            "type": "string",
                            "description": "Eklenecek dosyalar",
                            "default": "."
                        },
                        "repo_path": {
                            "type": "string",
                            "description": "Repository yolu",
                            "default": "."
                        }
                    }
                }
            },
            "git_commit": {
                "name": "git_commit",
                "description": "Git commit oluştur",
                "inputSchema": {
                    "type": "object",
                    "properties": {
                        "message": {
                            "type": "string",
                            "description": "Commit mesajı"
                        },
                        "repo_path": {
                            "type": "string",
                            "description": "Repository yolu",
                            "default": "."
                        }
                    },
                    "required": ["message"]
                }
            },
            "git_push": {
                "name": "git_push",
                "description": "Git push işlemi",
                "inputSchema": {
                    "type": "object",
                    "properties": {
                        "remote": {
                            "type": "string",
                            "description": "Remote adı",
                            "default": "origin"
                        },
                        "branch": {
                            "type": "string",
                            "description": "Branch adı",
                            "default": "main"
                        },
                        "repo_path": {
                            "type": "string",
                            "description": "Repository yolu",
                            "default": "."
                        }
                    }
                }
            },
            "code_agent_analyze": {
                "name": "code_agent_analyze",
                "description": "Kod dosyasını analiz et",
                "inputSchema": {
                    "type": "object",
                    "properties": {
                        "file_path": {
                            "type": "string",
                            "description": "Analiz edilecek dosya yolu"
                        }
                    },
                    "required": ["file_path"]
                }
            },
            "code_agent_edit": {
                "name": "code_agent_edit",
                "description": "Kod düzenleme önerileri",
                "inputSchema": {
                    "type": "object",
                    "properties": {
                        "file_path": {
                            "type": "string",
                            "description": "Düzenlenecek dosya yolu"
                        },
                        "edit_type": {
                            "type": "string",
                            "description": "Düzenleme tipi (optimize, refactor, fix)",
                            "default": "optimize"
                        }
                    },
                    "required": ["file_path"]
                }
            },
            "code_agent_refactor": {
                "name": "code_agent_refactor",
                "description": "Kod refactoring yap",
                "inputSchema": {
                    "type": "object",
                    "properties": {
                        "file_path": {
                            "type": "string",
                            "description": "Refactor edilecek dosya yolu"
                        },
                        "refactor_type": {
                            "type": "string",
                            "description": "Refactor tipi (format, comments, general)",
                            "default": "general"
                        }
                    },
                    "required": ["file_path"]
                }
            }
        }

    def hello_world(self, args: Dict[str, Any]) -> str:
        """Test fonksiyonu"""
        message = args.get("message", "Merhaba Dünya!")
        return f"KayraDeniz Server'dan selam! Mesajın: {message}"

    def create_file(self, args: Dict[str, Any]) -> str:
        """Dosya oluştur"""
        try:
            file_path = self._get_required_str(args, "file_path")
            content = self._get_required_str(args, "content")
            working_directory = self._get_optional_str(args, "working_directory")
            
            # Working directory varsa onu kullan
            if working_directory and not os.path.isabs(file_path):
                file_path = os.path.join(working_directory, file_path)
                print(f"INFO: File created in user workspace: '{file_path}'", file=sys.stderr)
            elif not os.path.isabs(file_path):
                # Fallback: User Documents
                user_documents = os.path.expanduser("~/Documents")
                file_path = os.path.join(user_documents, file_path)
                print(f"INFO: No workspace set, using Documents: '{file_path}'", file=sys.stderr)
            
            # Klasörü oluştur
            dir_path = os.path.dirname(file_path)
            if dir_path:
                os.makedirs(dir_path, exist_ok=True)
            
            with open(file_path, 'w', encoding='utf-8') as f:
                f.write(content)
            
            return f"Dosya başarıyla oluşturuldu: {file_path} ({len(content)} karakter)"
        except Exception as e:
            return f"Hata: {str(e)}"

    def read_file(self, args: Dict[str, Any]) -> str:
        """Dosya oku"""
        try:
            file_path = self._get_required_str(args, "file_path")
            
            if not os.path.exists(file_path):
                return f"Hata: Dosya bulunamadı: {file_path}"
            
            with open(file_path, 'r', encoding='utf-8') as f:
                content = f.read()
            total_lines = len(content.splitlines())

            return (
                f"Dosya içeriği ({file_path}):\n"
                f"Toplam Satır: {total_lines}\n\n{content}"
            )
        except Exception as e:
            return f"Hata: {str(e)}"

    def list_files(self, args: Dict[str, Any]) -> str:
        """Dosyaları listele"""
        try:
            directory_path = str(args.get("directory_path", "."))
            
            if not os.path.exists(directory_path):
                return f"Hata: Dizin bulunamadı: {directory_path}"
            
            files: List[str] = []
            for item in os.listdir(directory_path):
                item_path: str = os.path.join(directory_path, item)
                if os.path.isfile(item_path):
                    files.append(f"📄 {item}")
                else:
                    files.append(f"📁 {item}/")
            
            return f"Dizin içeriği ({directory_path}):\n" + "\n".join(files)
        except Exception as e:
            return f"Hata: {str(e)}"

    def write_code(self, args: Dict[str, Any]) -> str:
        """Kod dosyası yaz"""
        try:
            file_path = self._get_required_str(args, "file_path")
            content = self._get_required_str(args, "content")
            language = str(args.get("language", "text"))
            working_directory = self._get_optional_str(args, "working_directory")
            
            # Working directory kullan ya da Documents'e varsayılan
            if not os.path.isabs(file_path):
                if working_directory and os.path.exists(working_directory):
                    file_path = os.path.join(working_directory, file_path)
                    print(f"INFO: Code file in working directory: '{file_path}'", file=sys.stderr)
                else:
                    user_documents = os.path.expanduser("~/Documents")
                    file_path = os.path.join(user_documents, file_path)
                    print(f"INFO: Code file relative path '{args['file_path']}' -> Documents: '{file_path}'", file=sys.stderr)
            
            # Dosyayı oluştur
            os.makedirs(os.path.dirname(file_path), exist_ok=True)
            with open(file_path, 'w', encoding='utf-8') as f:
                f.write(content)
            
            return f"Kod dosyası oluşturuldu: {file_path} ({language}) - {len(content)} karakter"
        except Exception as e:
            return f"Hata: {str(e)}"

    def generate_project_structure(self, args: Dict[str, Any]) -> str:
        """Proje yapısı oluştur"""
        try:
            project_name = self._get_required_str(args, "project_name")
            project_type = str(args.get("project_type", "web"))
            base_path_value = args.get("base_path", ".")
            base_path = str(base_path_value)
            working_directory = self._get_optional_str(args, "working_directory")

            resolved_base_path = base_path
            # Working directory kullan ya da Documents'e varsayılan
            if base_path == "." or not os.path.isabs(base_path):
                if working_directory and os.path.exists(working_directory):
                    if base_path == ".":
                        resolved_base_path = working_directory
                    else:
                        resolved_base_path = os.path.join(working_directory, base_path)
                    print(f"INFO: Project in working directory: '{resolved_base_path}'", file=sys.stderr)
                else:
                    user_documents = os.path.expanduser("~/Documents")
                    if base_path == ".":
                        resolved_base_path = user_documents
                    else:
                        resolved_base_path = os.path.join(user_documents, base_path)
                    print(f"INFO: Project base path -> Documents: '{resolved_base_path}'", file=sys.stderr)

            project_path = os.path.join(resolved_base_path, project_name)
            
            # Temel klasör yapısı
            if project_type == "web":
                folders: List[str] = ["css", "js", "images", "assets"]
                files: Dict[str, str] = {
                    "index.html": f"<!DOCTYPE html>\n<html>\n<head>\n    <title>{project_name}</title>\n    <link rel='stylesheet' href='css/style.css'>\n</head>\n<body>\n    <h1>Merhaba {project_name}!</h1>\n    <script src='js/app.js'></script>\n</body>\n</html>",
                    "css/style.css": f"/* {project_name} stilleri */\nbody {{\n    font-family: Arial, sans-serif;\n    margin: 0;\n    padding: 20px;\n    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);\n    color: white;\n}}\n\nh1 {{\n    text-align: center;\n    margin-top: 100px;\n}}",
                    "js/app.js": f"// {project_name} JavaScript kodu\nconsole.log('Merhaba {project_name}!');\n\n// Sayfa yüklendiğinde\ndocument.addEventListener('DOMContentLoaded', function() {{\n    console.log('{project_name} hazır!');\n}});"
                }
            else:
                folders = ["src", "docs", "tests"]
                files = {
                    "README.md": f"# {project_name}\n\nYeni proje açıklaması\n\n## Özellikler\n- Modern yapı\n- Test desteği\n- Dokümantasyon",
                    "src/main.py": f"#!/usr/bin/env python3\n# {project_name} ana dosyası\n\ndef main():\n    print('Merhaba {project_name}!')\n    \nif __name__ == '__main__':\n    main()"
                }
            
            # Klasörleri oluştur
            for folder in folders:
                os.makedirs(os.path.join(project_path, folder), exist_ok=True)
            
            # Dosyaları oluştur
            for file_path, content in files.items():
                full_path = os.path.join(project_path, file_path)
                os.makedirs(os.path.dirname(full_path), exist_ok=True)
                with open(full_path, 'w', encoding='utf-8') as f:
                    f.write(content)
            
            return f"Proje yapısı oluşturuldu: {project_path}\nTip: {project_type}\nKlasörler: {', '.join(folders)}\nDosyalar: {', '.join(files.keys())}"
        except Exception as e:
            return f"Hata: {str(e)}"

    # === GitHub ve Git İşlevleri ===
    
    def set_github_token(self, args: Dict[str, Any]) -> str:
        """GitHub token'ı ayarla"""
        try:
            token = self._get_required_str(args, "token")
            self.github_token = token
            self.git_user_name = self._get_optional_str(args, "git_user_name")
            self.git_user_email = self._get_optional_str(args, "git_user_email")
            
            # Token'ı test et
            headers: Dict[str, str] = {
                'Authorization': f'token {self.github_token}',
                'Accept': 'application/vnd.github.v3+json'
            }
            response = requests.get(f"{self.github_api_base}/user", headers=headers, timeout=15)
            
            if response.status_code == 200:
                user_info = response.json()
                return f"GitHub token başarıyla ayarlandı! Kullanıcı: {user_info.get('login', 'Bilinmeyen')}"
            else:
                return f"Hata: GitHub token geçersiz ({response.status_code})"
        except Exception as e:
            return f"Hata: {str(e)}"

    def github_clone(self, args: Dict[str, Any]) -> str:
        """GitHub repository clone et"""
        try:
            repo_url = self._get_required_str(args, "repo_url")
            target_dir_value = args.get("target_dir", "./cloned-repo")
            target_dir = str(target_dir_value)
            working_directory = self._get_optional_str(args, "working_directory")

            resolved_target_dir = target_dir
            # Working directory kullan
            if working_directory and not os.path.isabs(target_dir):
                resolved_target_dir = os.path.join(working_directory, target_dir)
            
            # Git clone komutu
            cmd: List[str] = ["git", "clone", repo_url, resolved_target_dir]
            result = subprocess.run(cmd, capture_output=True, text=True)
            
            if result.returncode == 0:
                return f"Repository başarıyla clone edildi: {resolved_target_dir}"
            else:
                return f"Clone hatası: {result.stderr}"
                
        except Exception as e:
            return f"Hata: {str(e)}"

    def github_status(self, args: Dict[str, Any]) -> str:
        """Git repository durumunu kontrol et"""
        try:
            repo_path_value = args.get("repo_path", ".")
            repo_path_str = str(repo_path_value)
            working_directory = self._get_optional_str(args, "working_directory")
            repo_path = self._resolve_path(repo_path_str, working_directory)

            # Git status
            cmd: List[str] = ["git", "status", "--porcelain"]
            result = self._run_subprocess(cmd, cwd=repo_path)
            
            if result.returncode == 0:
                if result.stdout.strip():
                    return f"Repository durumu:\n{result.stdout}"
                else:
                    return "Repository temiz - commit edilecek değişiklik yok"
            else:
                return f"Status hatası: {result.stderr}"
                
        except Exception as e:
            return f"Hata: {str(e)}"

    def github_commit(self, args: Dict[str, Any]) -> str:
        """Git commit oluştur"""
        try:
            message = self._get_required_str(args, "message")
            repo_path_value = args.get("repo_path", ".")
            repo_path_str = str(repo_path_value)
            working_directory = self._get_optional_str(args, "working_directory")
            repo_path = self._resolve_path(repo_path_str, working_directory)
            add_all = self._get_bool(args, "add_all", True)

            # Git config kontrol et
            if self.git_user_name and self.git_user_email:
                self._run_subprocess(["git", "config", "user.name", self.git_user_name], cwd=repo_path)
                self._run_subprocess(["git", "config", "user.email", self.git_user_email], cwd=repo_path)
            
            # Tüm dosyaları ekle
            if add_all:
                add_result = self._run_subprocess(["git", "add", "."], cwd=repo_path)
                if add_result.returncode != 0:
                    return f"Add hatası: {add_result.stderr}"
            
            # Commit oluştur
            cmd: List[str] = ["git", "commit", "-m", message]
            result = self._run_subprocess(cmd, cwd=repo_path)
            
            if result.returncode == 0:
                return f"Commit oluşturuldu: {message}"
            else:
                return f"Commit hatası: {result.stderr}"
                
        except Exception as e:
            return f"Hata: {str(e)}"

    def github_push(self, args: Dict[str, Any]) -> str:
        """GitHub'a push et"""
        try:
            repo_path_value = args.get("repo_path", ".")
            repo_path_str = str(repo_path_value)
            remote = str(args.get("remote", "origin"))
            branch = str(args.get("branch", "main"))
            working_directory = self._get_optional_str(args, "working_directory")
            repo_path = self._resolve_path(repo_path_str, working_directory)

            # Git push
            cmd: List[str] = ["git", "push", remote, branch]
            result = self._run_subprocess(cmd, cwd=repo_path)
            
            if result.returncode == 0:
                return f"Başarıyla push edildi: {remote}/{branch}"
            else:
                return f"Push hatası: {result.stderr}"
                
        except Exception as e:
            return f"Hata: {str(e)}"

    def github_create_repo(self, args: Dict[str, Any]) -> str:
        """GitHub'da yeni repository oluştur"""
        try:
            if not self.github_token:
                return "Hata: GitHub token ayarlanmamış! Önce set_github_token kullanın."
            
            repo_name = self._get_required_str(args, "name")
            description = str(args.get("description", ""))
            private = self._get_bool(args, "private", False)
            
            headers = {
                'Authorization': f'token {self.github_token}',
                'Accept': 'application/vnd.github.v3+json',
                'Content-Type': 'application/json'
            }
            
            data: Dict[str, Any] = {
                "name": repo_name,
                "description": description,
                "private": private
            }
            
            response = requests.post(f"{self.github_api_base}/user/repos", 
                                   headers=headers, json=data, timeout=15)
            
            if response.status_code == 201:
                repo_info = response.json()
                return f"Repository oluşturuldu: {repo_info['html_url']}"
            else:
                return f"Repository oluşturma hatası: {response.status_code} - {response.text}"
                
        except Exception as e:
            return f"Hata: {str(e)}"

    def github_search_code(self, args: Dict[str, Any]) -> str:
        """GitHub'da kod ara"""
        try:
            if not self.github_token:
                return "Hata: GitHub token ayarlanmamış! Önce set_github_token kullanın."
            
            query = self._get_required_str(args, "query")
            headers = {
                'Authorization': f'token {self.github_token}',
                'Accept': 'application/vnd.github.v3+json'
            }
            
            response = requests.get(f"{self.github_api_base}/search/code?q={query}", 
                                  headers=headers)
            
            if response.status_code == 200:
                results = cast(Dict[str, Any], response.json())
                total = int(results.get('total_count', 0))
                raw_items = results.get('items', [])
                items = cast(List[Dict[str, Any]], raw_items)[:5]
                
                output = f"Kod arama sonuçları ({total} sonuç bulundu):\n\n"
                for item in items:
                    repo_info = item.get('repository')
                    if not isinstance(repo_info, dict):
                        continue
                    repo_dict = cast(Dict[str, Any], repo_info)
                    repository_name = str(repo_dict.get('full_name', ''))
                    file_name = str(item.get('name', ''))
                    path = str(item.get('path', ''))
                    url = str(item.get('html_url', ''))
                    output += f"📁 {repository_name}\n"
                    output += f"📄 {file_name} ({path})\n"
                    output += f"🔗 {url}\n\n"
                
                return output
            else:
                return f"Arama hatası: {response.status_code} - {response.text}"
                
        except Exception as e:
            return f"Hata: {str(e)}"

    def github_create_gist(self, args: Dict[str, Any]) -> str:
        """GitHub Gist oluştur"""
        try:
            if not self.github_token:
                return "Hata: GitHub token ayarlanmamış! Önce set_github_token kullanın."
            
            description = str(args.get("description", "KayraDeniz Code Snippet"))
            filename = self._get_required_str(args, "filename")
            content = self._get_required_str(args, "content")
            public = self._get_bool(args, "public", True)
            
            headers = {
                'Authorization': f'token {self.github_token}',
                'Accept': 'application/vnd.github.v3+json',
                'Content-Type': 'application/json'
            }
            
            data: Dict[str, Any] = {
                "description": description,
                "public": public,
                "files": {
                    filename: {
                        "content": content
                    }
                }
            }
            
            response = requests.post(f"{self.github_api_base}/gists", 
                                   headers=headers, json=data, timeout=15)
            
            if response.status_code == 201:
                gist_info = response.json()
                return f"Gist oluşturuldu: {gist_info['html_url']}"
            else:
                return f"Gist oluşturma hatası: {response.status_code} - {response.text}"
                
        except Exception as e:
            return f"Hata: {str(e)}"

    def github_create_issue(self, args: Dict[str, Any]) -> str:
        """GitHub Issue oluştur"""
        try:
            if not self.github_token:
                return "Hata: GitHub token ayarlanmamış! Önce set_github_token kullanın."
            
            owner = self._get_required_str(args, "owner")
            repo = self._get_required_str(args, "repo")
            title = self._get_required_str(args, "title")
            body = str(args.get("body", ""))
            
            headers = {
                'Authorization': f'token {self.github_token}',
                'Accept': 'application/vnd.github.v3+json',
                'Content-Type': 'application/json'
            }
            
            data: Dict[str, Any] = {
                "title": title,
                "body": body
            }
            
            response = requests.post(f"{self.github_api_base}/repos/{owner}/{repo}/issues", 
                                   headers=headers, json=data, timeout=15)
            
            if response.status_code == 201:
                issue_info = response.json()
                return f"Issue oluşturuldu: {issue_info['html_url']}"
            else:
                return f"Issue oluşturma hatası: {response.status_code} - {response.text}"
                
        except Exception as e:
            return f"Hata: {str(e)}"

    # === Git İşlevleri ===
    
    def git_init(self, args: Dict[str, Any]) -> str:
        """Git repository initialize et"""
        try:
            repo_path_value = args.get("repo_path", ".")
            repo_path_str = str(repo_path_value)
            working_directory = self._get_optional_str(args, "working_directory")
            repo_path = self._resolve_path(repo_path_str, working_directory)

            cmd: List[str] = ["git", "init"]
            result = self._run_subprocess(cmd, cwd=repo_path)
            
            if result.returncode == 0:
                return f"Git repository başlatıldı: {repo_path}"
            else:
                return f"Git init hatası: {result.stderr}"
                
        except Exception as e:
            return f"Hata: {str(e)}"

    def git_add(self, args: Dict[str, Any]) -> str:
        """Git add işlemi"""
        try:
            files = str(args.get("files", "."))
            repo_path_value = args.get("repo_path", ".")
            repo_path_str = str(repo_path_value)
            working_directory = self._get_optional_str(args, "working_directory")
            repo_path = self._resolve_path(repo_path_str, working_directory)

            cmd: List[str] = ["git", "add", files]
            result = self._run_subprocess(cmd, cwd=repo_path)
            
            if result.returncode == 0:
                return f"Dosyalar stage'e eklendi: {files}"
            else:
                return f"Git add hatası: {result.stderr}"
                
        except Exception as e:
            return f"Hata: {str(e)}"

    def git_commit(self, args: Dict[str, Any]) -> str:
        """Git commit işlemi"""
        try:
            message = self._get_required_str(args, "message")
            repo_path_value = args.get("repo_path", ".")
            repo_path_str = str(repo_path_value)
            working_directory = self._get_optional_str(args, "working_directory")
            repo_path = self._resolve_path(repo_path_str, working_directory)

            # Git config kontrol et
            if self.git_user_name and self.git_user_email:
                self._run_subprocess(["git", "config", "user.name", self.git_user_name], cwd=repo_path)
                self._run_subprocess(["git", "config", "user.email", self.git_user_email], cwd=repo_path)

            cmd: List[str] = ["git", "commit", "-m", message]
            result = self._run_subprocess(cmd, cwd=repo_path)
            
            if result.returncode == 0:
                return f"Commit oluşturuldu: {message}"
            else:
                return f"Git commit hatası: {result.stderr}"
                
        except Exception as e:
            return f"Hata: {str(e)}"

    def git_push(self, args: Dict[str, Any]) -> str:
        """Git push işlemi"""
        try:
            repo_path_value = args.get("repo_path", ".")
            repo_path_str = str(repo_path_value)
            remote = str(args.get("remote", "origin"))
            branch = str(args.get("branch", "main"))
            working_directory = self._get_optional_str(args, "working_directory")
            repo_path = self._resolve_path(repo_path_str, working_directory)

            cmd: List[str] = ["git", "push", remote, branch]
            result = self._run_subprocess(cmd, cwd=repo_path)
            
            if result.returncode == 0:
                return f"Push başarılı: {remote}/{branch}"
            else:
                return f"Git push hatası: {result.stderr}"
                
        except Exception as e:
            return f"Hata: {str(e)}"

    def git_pull(self, args: Dict[str, Any]) -> str:
        """Git pull işlemi"""
        try:
            repo_path_value = args.get("repo_path", ".")
            repo_path_str = str(repo_path_value)
            remote = str(args.get("remote", "origin"))
            branch = str(args.get("branch", "main"))
            working_directory = self._get_optional_str(args, "working_directory")
            repo_path = self._resolve_path(repo_path_str, working_directory)

            cmd: List[str] = ["git", "pull", remote, branch]
            result = self._run_subprocess(cmd, cwd=repo_path)
            
            if result.returncode == 0:
                return f"Pull başarılı: {remote}/{branch}"
            else:
                return f"Git pull hatası: {result.stderr}"
                
        except Exception as e:
            return f"Hata: {str(e)}"

    def git_branch(self, args: Dict[str, Any]) -> str:
        """Git branch işlemleri"""
        try:
            action = str(args.get("action", "list"))  # list, create, checkout
            branch_name_optional = args.get("branch_name")
            branch_name = str(branch_name_optional) if branch_name_optional is not None else None
            repo_path_value = args.get("repo_path", ".")
            repo_path_str = str(repo_path_value)
            working_directory = self._get_optional_str(args, "working_directory")
            repo_path = self._resolve_path(repo_path_str, working_directory)
            
            if action == "list":
                cmd: List[str] = ["git", "branch", "-a"]
            elif action == "create" and branch_name:
                cmd = ["git", "branch", branch_name]
            elif action == "checkout" and branch_name:
                cmd = ["git", "checkout", branch_name]
            else:
                return "Hata: Geçersiz action veya eksik branch_name"
            
            result = self._run_subprocess(cmd, cwd=repo_path)
            
            if result.returncode == 0:
                return f"Branch işlemi başarılı:\n{result.stdout}"
            else:
                return f"Git branch hatası: {result.stderr}"
                
        except Exception as e:
            return f"Hata: {str(e)}"

    # === Kod Agent İşlevleri ===
    
    def code_agent_analyze(self, args: Dict[str, Any]) -> str:
        """Gelişmiş kod analizi - AI destekli"""
        try:
            file_path_arg = self._get_required_str(args, "file_path")
            working_directory = self._get_optional_str(args, "working_directory")
            file_path = self._resolve_path(file_path_arg, working_directory)

            if not os.path.exists(file_path):
                return f"Hata: Dosya bulunamadı: {file_path}"

            with open(file_path, 'r', encoding='utf-8') as f:
                content = f.read()
            
            # Gelişmiş kod analizi
            lines: List[str] = content.split('\n')
            total_lines = len(lines)
            non_empty_lines = len([line for line in lines if line.strip()])
            comment_lines = 0
            function_count = 0
            class_count = 0
            complexity_score = 0
            
            # Dil-spesifik analiz
            extension = os.path.splitext(file_path)[1].lower()
            language_map = {
                '.py': 'Python', '.js': 'JavaScript', '.ts': 'TypeScript',
                '.html': 'HTML', '.css': 'CSS', '.java': 'Java',
                '.cpp': 'C++', '.c': 'C', '.json': 'JSON', '.md': 'Markdown'
            }
            language = language_map.get(extension, 'Unknown')
            
            # Dil-spesifik pattern'lar
            if language == 'Python':
                comment_lines = len([line for line in lines if line.strip().startswith('#')])
                function_count = len([line for line in lines if line.strip().startswith('def ')])
                class_count = len([line for line in lines if line.strip().startswith('class ')])
                complexity_score = content.count('if ') + content.count('for ') + content.count('while ')
            elif language in ['JavaScript', 'TypeScript']:
                comment_lines = len([line for line in lines if line.strip().startswith('//') or '/*' in line])
                function_count = content.count('function ') + content.count('=>')
                class_count = content.count('class ')
                complexity_score = content.count('if(') + content.count('if ') + content.count('for(') + content.count('while(')
            elif language == 'Java':
                comment_lines = len([line for line in lines if line.strip().startswith('//') or '/*' in line])
                function_count = content.count('public ') + content.count('private ') + content.count('protected ')
                class_count = content.count('class ') + content.count('interface ')
                complexity_score = content.count('if(') + content.count('for(') + content.count('while(')
            
            # Kod kalitesi metrikleri
            comment_ratio = (comment_lines / non_empty_lines * 100) if non_empty_lines > 0 else 0
            avg_line_length = sum(len(line) for line in lines) / len(lines) if lines else 0
            
            # Potansiyel sorunlar
            issues: List[str] = []
            if comment_ratio < 10:
                issues.append("🔸 Düşük comment oranı - daha fazla dokümantasyon gerekli")
            if avg_line_length > 100:
                issues.append("🔸 Çok uzun satırlar - okunabilirlik sorunu")
            if complexity_score > non_empty_lines * 0.3:
                issues.append("🔸 Yüksek kompleksite - refactoring gerekebilir")
            if function_count == 0 and non_empty_lines > 20:
                issues.append("🔸 Fonksiyonlara bölünmemiş kod - modüler yapı eksik")
            
            # Güvenlik kontrolleri (basit)
            security_issues: List[str] = []
            if language == 'Python':
                if 'eval(' in content:
                    security_issues.append("⚠️ eval() kullanımı - güvenlik riski")
                if 'exec(' in content:
                    security_issues.append("⚠️ exec() kullanımı - güvenlik riski")
                if 'os.system(' in content:
                    security_issues.append("⚠️ os.system() kullanımı - güvenlik riski")
            elif language in ['JavaScript', 'TypeScript']:
                if 'eval(' in content:
                    security_issues.append("⚠️ eval() kullanımı - güvenlik riski")
                if 'innerHTML' in content:
                    security_issues.append("⚠️ innerHTML kullanımı - XSS riski")
                if 'document.write(' in content:
                    security_issues.append("⚠️ document.write() kullanımı - güvenlik riski")
            
            # Performans önerileri
            performance_tips: List[str] = []
            if language == 'Python':
                if content.count('for ') > 5:
                    performance_tips.append("💨 List comprehension veya generator kullanmayı düşünün")
                if 'import *' in content:
                    performance_tips.append("💨 Spesifik import'lar kullanın (from x import y)")
            elif language in ['JavaScript', 'TypeScript']:
                if content.count('document.getElementById') > 3:
                    performance_tips.append("💨 DOM elementlerini cache'leyin")
                if 'var ' in content:
                    performance_tips.append("💨 let/const kullanın, var yerine")
            
            analysis = f"""
🎯 KayraDeniz Kod Analizi Raporu
{'='*50}

📁 **Dosya:** {os.path.basename(file_path)}
🔤 **Dil:** {language}
📊 **Boyut:** {os.path.getsize(file_path)} bytes

📈 **Kod Metrikleri:**
├─ Toplam satır: {total_lines}
├─ Kod satırı: {non_empty_lines}
├─ Yorum satırı: {comment_lines} ({comment_ratio:.1f}%)
├─ Fonksiyon sayısı: {function_count}
├─ Class sayısı: {class_count}
├─ Ortalama satır uzunluğu: {avg_line_length:.1f} karakter
└─ Kompleksite skoru: {complexity_score}

📊 **Kod Kalitesi Değerlendirmesi:**
├─ Comment Coverage: {'✅ İyi' if comment_ratio >= 15 else '⚠️ Düşük' if comment_ratio >= 5 else '❌ Yetersiz'}
├─ Line Length: {'✅ İyi' if avg_line_length <= 80 else '⚠️ Uzun' if avg_line_length <= 120 else '❌ Çok Uzun'}
├─ Complexity: {'✅ Basit' if complexity_score <= non_empty_lines * 0.2 else '⚠️ Orta' if complexity_score <= non_empty_lines * 0.4 else '❌ Karmaşık'}
└─ Modularity: {'✅ İyi' if function_count > 0 or non_empty_lines <= 50 else '⚠️ Geliştirilmeli'}
"""

            if issues:
                analysis += f"\n🔍 **Tespit Edilen Sorunlar:**\n"
                for issue in issues:
                    analysis += f"   {issue}\n"
            
            if security_issues:
                analysis += f"\n🛡️ **Güvenlik Uyarıları:**\n"
                for issue in security_issues:
                    analysis += f"   {issue}\n"
            
            if performance_tips:
                analysis += f"\n⚡ **Performans Önerileri:**\n"
                for tip in performance_tips:
                    analysis += f"   {tip}\n"
            
            analysis += f"""
💡 **İyileştirme Önerileri:**
   🔸 Kod tekrarlarını azaltın (DRY principle)
   🔸 Anlamlı değişken ve fonksiyon isimleri kullanın
   🔸 Error handling ekleyin
   🔸 Unit test'ler yazın
   🔸 Type hints/annotations ekleyin ({language} için uygunsa)
   🔸 Code formatting tool'ları kullanın (prettier, black, etc.)

🚀 **Next Steps:**
   1. Priority: {'Güvenlik sorunlarını düzeltin' if security_issues else 'Kod kalitesini artırın'}
   2. Refactoring: {'Gerekli' if complexity_score > non_empty_lines * 0.3 else 'Opsiyonel'}
   3. Documentation: {'Kritik' if comment_ratio < 10 else 'İyileştirilebilir' if comment_ratio < 20 else 'Yeterli'}
"""

            return analysis
            
        except Exception as e:
            return f"Hata: {str(e)}"

    def code_agent_edit(self, args: Dict[str, Any]) -> str:
        """Gelişmiş kod düzenleme önerileri"""
        try:
            file_path_arg = self._get_required_str(args, "file_path")
            edit_type = str(args.get("edit_type", "optimize"))  # optimize, refactor, fix, modernize
            working_directory = self._get_optional_str(args, "working_directory")
            file_path = self._resolve_path(file_path_arg, working_directory)

            if not os.path.exists(file_path):
                return f"Hata: Dosya bulunamadı: {file_path}"

            with open(file_path, 'r', encoding='utf-8') as f:
                content = f.read()
            lines = content.splitlines()
            total_lines = len(lines)
            preview_line_count = min(5, total_lines)
            preview_snippet = lines[:preview_line_count]
            
            extension = os.path.splitext(file_path)[1].lower()
            language_map = {
                '.py': 'Python', '.js': 'JavaScript', '.ts': 'TypeScript',
                '.html': 'HTML', '.css': 'CSS', '.java': 'Java'
            }
            language = language_map.get(extension, 'Unknown')
            
            suggestions: List[str] = []
            code_examples: List[str] = []
            
            if edit_type == "optimize":
                suggestions = [
                    "🚀 **Performans Optimizasyonu**",
                    "├─ Gereksiz döngüleri optimize edin",
                    "├─ Caching mekanizmaları ekleyin",
                    "├─ Database sorgularını optimize edin",
                    "├─ Memory kullanımını azaltın",
                    "└─ Asynchronous operations kullanın"
                ]
                
                if language == 'Python':
                    code_examples.append("""
🐍 **Python Optimizasyon Örneği:**
```python
# Önce (Yavaş)
result = []
for item in large_list:
    if item > 10:
        result.append(item * 2)

# Sonra (Hızlı)
result = [item * 2 for item in large_list if item > 10]
```""")
                    
            elif edit_type == "refactor":
                suggestions = [
                    "♻️ **Code Refactoring**",
                    "├─ Fonksiyonları küçük parçalara bölün",
                    "├─ Code duplications'ı kaldırın",
                    "├─ Design patterns uygulayın",
                    "├─ SOLID principles'ı takip edin",
                    "└─ Clean Code practices kullanın"
                ]
                
                if language == 'JavaScript':
                    code_examples.append("""
🔧 **JavaScript Refactoring Örneği:**
```javascript
// Önce (Karmaşık)
function processUser(user) {
    if (user && user.name && user.email) {
        // lots of code here
        return result;
    }
}

// Sonra (Temiz)
function validateUser(user) {
    return user && user.name && user.email;
}

function processUser(user) {
    if (!validateUser(user)) return null;
    // clean processing logic
    return result;
}
```""")
                    
            elif edit_type == "fix":
                suggestions = [
                    "🐛 **Bug Fixes & Error Handling**",
                    "├─ Null/undefined check'ler ekleyin",
                    "├─ Try-catch blokları kullanın",
                    "├─ Input validation yapın",
                    "├─ Edge case'leri handle edin",
                    "└─ Logging mekanizması ekleyin"
                ]
                
                code_examples.append("""
🛡️ **Error Handling Örneği:**
```python
# Güvenli kod örneği
def safe_divide(a, b):
    try:
        if b == 0:
            raise ValueError("Division by zero!")
        return a / b
    except (TypeError, ValueError) as e:
        print(f"Error: {e}")
        return None
```""")
                
            elif edit_type == "modernize":
                suggestions = [
                    "🆕 **Modern Code Practices**",
                    "├─ ES6+ features kullanın (JS/TS)",
                    "├─ Type annotations ekleyin",
                    "├─ Async/await patterns kullanın",
                    "├─ Modern framework features kullanın",
                    "└─ Best practices'a güncelleyin"
                ]
                
                if language in ['JavaScript', 'TypeScript']:
                    code_examples.append("""
🌟 **Modern JavaScript Örneği:**
```javascript
// Eski stil
function getUsers(callback) {
    fetch('/api/users')
        .then(response => response.json())
        .then(data => callback(data))
        .catch(error => console.error(error));
}

// Modern stil
async function getUsers() {
    try {
        const response = await fetch('/api/users');
        return await response.json();
    } catch (error) {
        console.error('Failed to fetch users:', error);
        throw error;
    }
}
```""")
            
            result = f"""
🛠️ KayraDeniz Kod Düzenleme Rehberi
{'='*50}

📁 **Dosya:** {os.path.basename(file_path)}
🎯 **Düzenleme Tipi:** {edit_type.title()}
🔤 **Dil:** {language}
📏 **Satır Sayısı:** {total_lines}
"""

            if preview_snippet:
                result += (
                    f"\n� **Kod Önizleme (ilk {preview_line_count} satır):**\n"
                )
                for idx, line in enumerate(preview_snippet, start=1):
                    result += f"   {idx:02d}: {line if line else ' '}\n"

            result += "\n💡 **Öneriler:**\n"
            
            for suggestion in suggestions:
                result += f"   {suggestion}\n"
            
            for example in code_examples:
                result += f"\n{example}\n"
            
            # Dil-spesifik öneriler
            if language == 'Python':
                result += """
🐍 **Python Spesifik Öneriler:**
   ├─ PEP 8 style guide'ı takip edin
   ├─ Type hints kullanın (Python 3.5+)
   ├─ f-string formatting kullanın
   ├─ Context managers (with statements) kullanın
   └─ Virtual environment kullanın
"""
            elif language in ['JavaScript', 'TypeScript']:
                result += """
🌐 **JavaScript/TypeScript Öneriler:**
   ├─ ESLint/Prettier kullanın
   ├─ const/let kullanın, var yerine
   ├─ Arrow functions kullanın
   ├─ Destructuring assignment kullanın
   └─ Module system kullanın (import/export)
"""
            
            result += f"""
🔧 **Uygulama Adımları:**
   1. 📋 Önce backup alın
   2. 🎯 Bir defada tek değişiklik yapın
   3. ✅ Her değişiklik sonrası test edin
   4. 📝 Değişiklikleri dokümante edin
   5. 🔄 Code review yaptırın

⚡ **Tools & Resources:**
   ├─ Linter: {language} için uygun linter kullanın
   ├─ Formatter: Otomatik code formatting
   ├─ Testing: Unit test'ler yazın
   └─ Documentation: Inline comments ve README güncelleyin
"""
            
            return result
            
        except Exception as e:
            return f"Hata: {str(e)}"

    def code_agent_refactor(self, args: Dict[str, Any]) -> str:
        """Otomatik kod refactoring"""
        try:
            file_path_arg = self._get_required_str(args, "file_path")
            refactor_type = str(args.get("refactor_type", "general"))  # format, comments, general, optimize
            working_directory = self._get_optional_str(args, "working_directory")
            create_backup = self._get_bool(args, "create_backup", True)
            file_path = self._resolve_path(file_path_arg, working_directory)

            if not os.path.exists(file_path):
                return f"Hata: Dosya bulunamadı: {file_path}"

            backup_path: Optional[str] = None
            if create_backup:
                backup_path = f"{file_path}.backup.{int(__import__('time').time())}"
                import shutil
                shutil.copy2(file_path, backup_path)

            with open(file_path, 'r', encoding='utf-8') as f:
                original_content = f.read()
            
            refactored_content = original_content
            changes_made: List[str] = []
            
            # Dil detection
            extension = os.path.splitext(file_path)[1].lower()
            language_map = {
                '.py': 'Python', '.js': 'JavaScript', '.ts': 'TypeScript',
                '.html': 'HTML', '.css': 'CSS', '.java': 'Java'
            }
            language = language_map.get(extension, 'Unknown')
            
            if refactor_type == "format":
                # Temel formatting
                lines = original_content.split('\n')
                formatted_lines: List[str] = []
                
                for line in lines:
                    # Trailing whitespace kaldır
                    formatted_line = line.rstrip()
                    
                    # Tab'ları space'e çevir (4 space)
                    formatted_line = formatted_line.expandtabs(4)
                    
                    formatted_lines.append(formatted_line)
                
                # Dosya sonunda boş satır olsun
                if formatted_lines and formatted_lines[-1].strip():
                    formatted_lines.append('')
                
                refactored_content = '\n'.join(formatted_lines)
                changes_made.append("✅ Trailing whitespace kaldırıldı")
                changes_made.append("✅ Tab'lar space'e çevrildi")
                changes_made.append("✅ Dosya sonu düzeltildi")
                
            elif refactor_type == "comments":
                # Comment ve dokümantasyon iyileştirme
                lines = original_content.split('\n')
                commented_lines: List[str] = []
                
                for i, line in enumerate(lines):
                    commented_lines.append(line)
                    
                    # Fonksiyon tanımlarından sonra comment ekle
                    if language == 'Python':
                        if line.strip().startswith('def ') and ':' in line:
                            if i + 1 < len(lines) and not lines[i + 1].strip().startswith('"""'):
                                commented_lines.append('    """TODO: Add function documentation"""')
                        elif line.strip().startswith('class ') and ':' in line:
                            if i + 1 < len(lines) and not lines[i + 1].strip().startswith('"""'):
                                commented_lines.append('    """TODO: Add class documentation"""')
                    
                    elif language in ['JavaScript', 'TypeScript']:
                        if ('function ' in line or '=>' in line) and '{' in line:
                            if i + 1 < len(lines) and not lines[i + 1].strip().startswith('//'):
                                indent = len(line) - len(line.lstrip())
                                commented_lines.append(' ' * (indent + 2) + '// TODO: Add function documentation')
                
                refactored_content = '\n'.join(commented_lines)
                changes_made.append("✅ Eksik dokümantasyon noktaları işaretlendi")
                
            elif refactor_type == "optimize":
                # Basit optimizasyonlar
                optimizations = 0
                
                if language == 'Python':
                    # String concatenation optimizations
                    if '+=' in refactored_content and 'str' in refactored_content:
                        refactored_content = refactored_content.replace(
                            "result += str(",
                            "result += f'"  # Promote f-string usage
                        )
                        optimizations += 1
                        changes_made.append("✅ String concatenation optimize edildi")
                    
                    # Import organization (basic)
                    lines = refactored_content.split('\n')
                    import_lines: List[str] = []
                    other_lines: List[str] = []
                    
                    for line in lines:
                        if line.strip().startswith(('import ', 'from ')):
                            import_lines.append(line)
                        else:
                            other_lines.append(line)
                    
                    if import_lines:
                        # Sort imports
                        import_lines.sort()
                        refactored_content = '\n'.join(import_lines + [''] + other_lines)
                        changes_made.append("✅ Import'lar düzenlendi")
                
                elif language in ['JavaScript', 'TypeScript']:
                    # var -> let/const conversion
                    var_count = refactored_content.count('var ')
                    refactored_content = refactored_content.replace('var ', 'let ')
                    if var_count > 0:
                        changes_made.append(f"✅ {var_count} adet 'var' -> 'let' çevrildi")
                    
                    # == -> === conversion
                    equality_count = refactored_content.count(' == ')
                    refactored_content = refactored_content.replace(' == ', ' === ')
                    refactored_content = refactored_content.replace(' != ', ' !== ')
                    if equality_count > 0:
                        changes_made.append(f"✅ {equality_count} adet '==' -> '===' çevrildi")
            
            elif refactor_type == "general":
                # Genel refactoring (yukarıdakilerin kombinasyonu)
                
                # 1. Formatting
                lines = refactored_content.split('\n')
                formatted_lines = [line.rstrip().expandtabs(4) for line in lines]
                refactored_content = '\n'.join(formatted_lines)
                changes_made.append("✅ Genel formatting uygulandı")
                
                # 2. Language-specific improvements
                if language == 'Python':
                    # f-string conversion (simple cases)
                    if '".format(' in refactored_content:
                        changes_made.append("✅ String formatting iyileştirmesi mevcut")
                
                elif language in ['JavaScript', 'TypeScript']:
                    # Modern JS features
                    if 'var ' in refactored_content:
                        var_count = refactored_content.count('var ')
                        refactored_content = refactored_content.replace('var ', 'let ')
                        changes_made.append(f"✅ {var_count} adet var->let çevrimi")
            
            # Değişiklik var mı kontrol et
            if refactored_content != original_content:
                # Refactored dosyayı kaydet
                with open(file_path, 'w', encoding='utf-8') as f:
                    f.write(refactored_content)
                
                # Stats
                original_lines = len(original_content.split('\n'))
                new_lines = len(refactored_content.split('\n'))
                size_change = len(refactored_content) - len(original_content)
                
                backup_line = ""
                if create_backup and backup_path:
                    backup_line = f"💾 **Backup:** {os.path.basename(backup_path)}"

                result = f"""
♻️ KayraDeniz Refactoring Tamamlandı!
{'='*50}

📁 **Dosya:** {os.path.basename(file_path)}
🔄 **Refactor Tipi:** {refactor_type.title()}
🔤 **Dil:** {language}
{backup_line}

📊 **Değişiklik İstatistikleri:**
├─ Orijinal satır sayısı: {original_lines}
├─ Yeni satır sayısı: {new_lines}
├─ Satır farkı: {new_lines - original_lines:+d}
├─ Boyut değişimi: {size_change:+d} bytes
└─ Toplam değişiklik: {len(changes_made)} işlem

✅ **Yapılan İyileştirmeler:**
"""
                
                for change in changes_made:
                    result += f"   {change}\n"
                
                result += f"""
🎯 **Sonraki Adımlar:**
   1. 🧪 Kodu test edin
   2. 📋 Code review yaptırın
   3. 🔧 Ek optimizasyonlar için 'optimize' tipini deneyin
   4. 📝 Değişiklikleri commit edin

💡 **İpucu:** Daha ileri refactoring için IDE extension'ları veya
   özel refactoring tool'ları kullanabilirsiniz.
"""
                
            else:
                result = f"""
✨ Kod Zaten Optimum Durumda!
{'='*30}

📁 **Dosya:** {os.path.basename(file_path)}
🎯 **Sonuç:** Bu dosyada {refactor_type} refactoring için değişiklik gerekmedi.

💡 **Öneriler:**
   ├─ Başka refactor tiplerini deneyin
   ├─ Manuel code review yapın
   └─ Unit test'ler ekleyin
"""
            
            return result
            
        except Exception as e:
            return f"Hata: {str(e)}"

    def handle_request(self, request: Dict[str, Any]) -> Dict[str, Any]:
        """JSON-RPC isteğini işle"""
        try:
            if request.get("method") == "list_tools":
                return {
                    "jsonrpc": "2.0",
                    "id": request.get("id"),
                    "result": {
                        "tools": list(self.get_tool_descriptions().values())
                    }
                }
            
            elif request.get("method") == "call_tool":
                params = request.get("params", {})
                tool_name = params.get("name")
                arguments = params.get("arguments", {})
                
                if tool_name not in self.tools:
                    return {
                        "jsonrpc": "2.0",
                        "id": request.get("id"),
                        "error": {
                            "code": -32601,
                            "message": f"Bilinmeyen tool: {tool_name}"
                        }
                    }
                
                result = self.tools[tool_name](arguments)
                
                return {
                    "jsonrpc": "2.0",
                    "id": request.get("id"),
                    "result": {
                        "content": [
                            {
                                "type": "text",
                                "text": result
                            }
                        ]
                    }
                }
            
            else:
                return {
                    "jsonrpc": "2.0",
                    "id": request.get("id"),
                    "error": {
                        "code": -32601,
                        "message": f"Bilinmeyen method: {request.get('method')}"
                    }
                }
        
        except Exception as e:
            return {
                "jsonrpc": "2.0",
                "id": request.get("id"),
                "error": {
                    "code": -32603,
                    "message": f"İç hata: {str(e)}"
                }
            }

def main():
    """Ana döngü - stdin'den gelen JSON-RPC isteklerini işle"""
    server = KayradenizToolServer()
    
    # UTF-8 encoding için
    import sys
    stdout = getattr(sys, "stdout", None)
    if stdout is not None:
        stdout_reconfigure = getattr(stdout, "reconfigure", None)
        if callable(stdout_reconfigure):
            stdout_reconfigure(encoding='utf-8')

    stderr = getattr(sys, "stderr", None)
    if stderr is not None:
        stderr_reconfigure = getattr(stderr, "reconfigure", None)
        if callable(stderr_reconfigure):
            stderr_reconfigure(encoding='utf-8')
    
    print("KayraDeniz Tool Server started", file=sys.stderr, flush=True)
    
    try:
        for line in sys.stdin:
            line = line.strip()
            if not line:
                continue
            
            try:
                request = json.loads(line)
                response = server.handle_request(request)
                
                print(json.dumps(response, ensure_ascii=False), flush=True)
                
            except json.JSONDecodeError as e:
                error_response: Dict[str, Any] = {
                    "jsonrpc": "2.0",
                    "id": None,
                    "error": {
                        "code": -32700,
                        "message": f"Parse error: {str(e)}"
                    }
                }
                print(json.dumps(error_response, ensure_ascii=False), flush=True)
            
            except Exception as e:
                print(f"Unexpected error: {str(e)}", file=sys.stderr, flush=True)
                import traceback
                print(traceback.format_exc(), file=sys.stderr, flush=True)
    
    except KeyboardInterrupt:
        print("Server stopping...", file=sys.stderr, flush=True)

if __name__ == "__main__":
    main()