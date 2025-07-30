const express = require('express');
const path = require('path');
const session = require('express-session');
const mysql = require('mysql2');
const bcrypt = require('bcrypt');
const bodyParser = require('body-parser');
const app = express();
const multer = require('multer');
const upload = multer({ dest: 'public/uploads/' });

// Configuração do banco de dados
const db = mysql.createConnection({
  host: 'localhost',
  user: 'root', // substitua pelo seu usuário do MySQL
  password: '', // substitua pela sua senha do MySQL
  database: 'auth_system'
});

// Conectar ao banco de dados
db.connect((err) => {
  if (err) {
    console.error('Erro ao conectar ao banco de dados:', err);
  } else {
    console.log('Conectado ao banco de dados MySQL');
  }
});

// Configurações do Express
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'ejs');

// Middlewares
app.use('/public', express.static(path.join(__dirname, 'public')));
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.json()); // Adicione esta linha para parsear JSON
app.use(express.static(path.join(__dirname, 'public')));
app.use(session({
  secret: 'secret-key',
  resave: false,
  saveUninitialized: true,
  cookie: { secure: false } // true se estiver usando HTTPS
}));

// Middleware para verificar autenticação
const requireAuth = (req, res, next) => {
  if (req.session.user) {
    next();
  } else {
    res.redirect('/login');
  }
};


// Middleware para verificar se é admin
const requireAdmin = (req, res, next) => {
  if (req.session.user && req.session.user.role === 'admin') {
    next();
  } else {
    res.status(403).send('Acesso negado');
  }
};

function renderDashboardWithDefaults(res, user) {
  res.render('dashboard', {
    title: 'Dashboard',
    user: user,
    totalOcorrencias: 0,
    totalAlertasAtivos: 0, // Valor padrão
    ocorrencias: [],
    checklist: null,
    alertas: 0 // Mantendo a variável original também, para compatibilidade
  });
}

app.get('/', requireAuth, (req, res) => {
  try {
    if (!req.session.user || !req.session.user.id) {
      return res.redirect('/login');
    }

    const hoje = new Date().toISOString().split('T')[0];
    
    // Busca checklist do dia
    db.query(
      'SELECT * FROM checklists WHERE user_id = ? AND DATE(data_criacao) = ?',
      [req.session.user.id, hoje],
      (err, checklistResults) => {
        if (err) {
          console.error('Erro ao buscar checklist:', err);
          return renderDashboardWithDefaults(res, req.session.user);
        }

        const checklist = checklistResults.length > 0 ? checklistResults[0] : null;
        
        // Busca o total de ocorrências (de todos os usuários)
        db.query(
          'SELECT COUNT(*) as total FROM ocorrencias',
          (err, countResults) => {
            if (err) {
              console.error('Erro ao contar ocorrências:', err);
              return renderDashboardWithDefaults(res, req.session.user);
            }

            // Busca o total de alertas ativos
            db.query(
              'SELECT COUNT(*) as total FROM alertas WHERE status = "ativo"',
              (err, alertasResults) => {
                if (err) {
                  console.error('Erro ao contar alertas:', err);
                  // Passa 0 como valor padrão se houver erro
                  const totalAlertasAtivos = 0;
                  
                  // Busca as últimas 5 ocorrências (de todos os usuários)
                  db.query(
                    `SELECT o.*, u.name as user_name 
                     FROM ocorrencias o
                     JOIN users u ON o.user_id = u.id
                     ORDER BY o.data_criacao DESC LIMIT 5`,
                    (err, ocorrenciasResults) => {
                      if (err) {
                        console.error('Erro ao buscar ocorrências:', err);
                        return renderDashboardWithDefaults(res, req.session.user);
                      }

                      res.render('dashboard', {
                        title: 'Dashboard',
                        user: req.session.user,
                        totalOcorrencias: countResults[0].total,
                        totalAlertasAtivos: totalAlertasAtivos,
                        ocorrencias: ocorrenciasResults || [],
                        checklist: checklist,
                        alertas: totalAlertasAtivos // Mantendo compatibilidade
                      });
                    }
                  );
                  return;
                }

                const totalAlertasAtivos = alertasResults[0].total;
                
                // Busca as últimas 5 ocorrências (de todos os usuários)
                db.query(
                  `SELECT o.*, u.name as user_name 
                   FROM ocorrencias o
                   JOIN users u ON o.user_id = u.id
                   ORDER BY o.data_criacao DESC LIMIT 5`,
                  (err, ocorrenciasResults) => {
                    if (err) {
                      console.error('Erro ao buscar ocorrências:', err);
                      return renderDashboardWithDefaults(res, req.session.user);
                    }

                    res.render('dashboard', {
                      title: 'Dashboard',
                      user: req.session.user,
                      totalOcorrencias: countResults[0].total,
                      totalAlertasAtivos: totalAlertasAtivos,
                      ocorrencias: ocorrenciasResults || [],
                      checklist: checklist,
                      alertas: totalAlertasAtivos // Mantendo compatibilidade
                    });
                  }
                );
              }
            );
          }
        );
      }
    );
  } catch (error) {
    console.error('Erro no dashboard:', error);
    renderDashboardWithDefaults(res, req.session.user);
  }
});

app.get('/login', (req, res) => {
  if (req.session.user) {
    return res.redirect('/');
  }
  res.render('auth/login', { 
    title: 'Login',
    error: null, // Garante que não há erro ao carregar a página
    email: ''   // Email vazio inicialmente
  });
});

app.post('/login', (req, res) => {
  const { email, password } = req.body;
  
  db.query('SELECT * FROM users WHERE email = ?', [email], (err, results) => {
    if (err) {
      return res.render('auth/login', {
        title: 'Login',
        error: 'Erro no servidor. Tente novamente mais tarde.',
        email: email
      });
    }
    
    if (results.length === 0) {
      return res.render('auth/login', {
        title: 'Login',
        error: 'Email ou senha incorretos',
        email: email
      });
    }
    
    const user = results[0];
    
    bcrypt.compare(password, user.password, (err, isMatch) => {
      if (err || !isMatch) {
        return res.render('auth/login', {
          title: 'Login',
          error: 'Email ou senha incorretos',
          email: email
        });
      }
      
      req.session.user = {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role // Adicione esta linha
      };
      
      res.redirect('/');
    });
  });
});

app.get('/register', (req, res) => {
  if (req.session.user) {
    return res.redirect('/');
  }
  res.render('auth/register', { 
    title: 'Cadastro',
    error: req.query.error
  });
});

app.post('/register', (req, res) => {
  const { name, email, password, confirmPassword } = req.body;
  
  // Validações básicas
  if (password !== confirmPassword) {
    return res.redirect('/register?error=As senhas não coincidem');
  }
  
  if (password.length < 6) {
    return res.redirect('/register?error=A senha deve ter pelo menos 6 caracteres');
  }
  
  // Verificar se o email já existe
  db.query('SELECT * FROM users WHERE email = ?', [email], (err, results) => {
    if (err) {
      return res.redirect('/register?error=Erro no servidor');
    }
    
    if (results.length > 0) {
      return res.redirect('/register?error=Email já cadastrado');
    }
    
    // Criptografar a senha
    bcrypt.hash(password, 10, (err, hash) => {
      if (err) {
        return res.redirect('/register?error=Erro no servidor');
      }
      
      // Inserir novo usuário (padrão como 'user')
      db.query(
        'INSERT INTO users (name, email, password, role) VALUES (?, ?, ?, ?)',
        [name, email, hash, 'user'],
        (err, results) => {
          if (err) {
            return res.redirect('/register?error=Erro ao cadastrar usuário');
          }
          
          res.redirect('/login?success=Cadastro realizado com sucesso! Faça login');
        }
      );
    });
  });
});

app.get('/logout', (req, res) => {
  req.session.destroy();
  res.redirect('/login');
});

app.get('/', requireAuth, (req, res) => {
  // Contar ocorrências do usuário
  db.query(
    'SELECT COUNT(*) as total FROM ocorrencias WHERE user_id = ?',
    [req.session.user.id],
    (err, countResults) => {
      if (err) {
        console.error(err);
        return res.status(500).send('Erro ao carregar dashboard');
      }

      // Pegar últimas 5 ocorrências
      db.query(
        'SELECT * FROM ocorrencias WHERE user_id = ? ORDER BY data_criacao DESC LIMIT 5',
        [req.session.user.id],
        (err, ocorrenciasResults) => {
          if (err) {
            console.error(err);
            return res.status(500).send('Erro ao carregar dashboard');
          }

          res.render('dashboard', {
            title: 'Dashboard',
            user: req.session.user,
            totalOcorrencias: countResults[0].total,
            ocorrencias: ocorrenciasResults
          });
        }
      );
    }
  );
});


app.get('/ocorrencias', requireAuth, (req, res) => {
  db.query(
    `SELECT o.*, u.name as user_name 
     FROM ocorrencias o
     JOIN users u ON o.user_id = u.id
     ORDER BY o.data_criacao DESC`,
    (err, results) => {
      if (err) {
        console.error(err);
        return res.status(500).render('ocorrencias', {
          title: 'Ocorrências',
          user: req.session.user,
          ocorrencias: [],
          error: 'Erro ao carregar ocorrências'
        });
      }

      res.render('ocorrencias', {
        title: 'Ocorrências',
        user: req.session.user,
        ocorrencias: results,
        error: req.query.error,
        success: req.query.success
      });
    }
  );
});

// Atualize também a rota POST para redirecionar corretamente em caso de erro
app.post('/ocorrencias', requireAuth, upload.single('imagem'), (req, res) => {
  const { tipo, descricao, urgencia, status } = req.body;
  const userId = req.session.user.id;
  
  let imagemPath = null;
  if (req.file) {
    imagemPath = '/uploads/' + req.file.filename;
  }

  db.query(
    'INSERT INTO ocorrencias (user_id, tipo, descricao, urgencia, imagem, status) VALUES (?, ?, ?, ?, ?, ?)',
    [userId, tipo, descricao, urgencia, imagemPath, status],
    (err, result) => {
      if (err) {
        console.error(err);
        return res.render('ocorrencias/nova', {  // Caminho atualizado aqui também
          title: 'Nova Ocorrência',
          user: req.session.user,
          error: 'Erro ao cadastrar ocorrência',
          formData: req.body
        });
      }
      res.redirect('/ocorrencias');
    }
  );
});

// Rota para exibir o formulário de nova ocorrência
app.get('/ocorrencias/nova', requireAuth, (req, res) => {
  res.render('ocorrencias/nova', {  // Note o caminho atualizado
    title: 'Nova Ocorrência',
    user: req.session.user
  });
});

app.get('/ocorrencias/editar/:id', requireAuth, (req, res) => {
  db.query(
    'SELECT * FROM ocorrencias WHERE id = ?',
    [req.params.id],
    (err, results) => {
      if (err || results.length === 0) {
        console.error(err);
        return res.redirect('/ocorrencias?error=Ocorrência não encontrada');
      }
      
      const ocorrencia = results[0];
      
      // Verifica se o usuário é o criador ou admin
      if (ocorrencia.user_id !== req.session.user.id && req.session.user.role !== 'admin') {
        return res.redirect('/ocorrencias?error=Você não tem permissão para editar esta ocorrência');
      }
      
      res.render('ocorrencias/editar', {
        title: 'Editar Ocorrência',
        user: req.session.user,
        ocorrencia: ocorrencia
      });
    }
  );
});

// Rota para processar a edição
app.post('/ocorrencias/editar/:id', requireAuth, upload.single('imagem'), (req, res) => {
  const { tipo, descricao, urgencia, status } = req.body;
  const ocorrenciaId = req.params.id;
  
  // Primeiro verifica se o usuário pode editar
  db.query(
    'SELECT user_id FROM ocorrencias WHERE id = ?',
    [ocorrenciaId],
    (err, results) => {
      if (err || results.length === 0) {
        return res.redirect('/ocorrencias?error=Ocorrência não encontrada');
      }
      
      if (results[0].user_id !== req.session.user.id && req.session.user.role !== 'admin') {
        return res.redirect('/ocorrencias?error=Você não tem permissão para editar esta ocorrência');
      }
      
      // Continua com a edição...
      let imagemPath = null;
      if (req.file) {
        imagemPath = '/uploads/' + req.file.filename;
      }

      let query;
      let params;
      
      if (imagemPath) {
        query = 'UPDATE ocorrencias SET tipo = ?, descricao = ?, urgencia = ?, imagem = ?, status = ? WHERE id = ?';
        params = [tipo, descricao, urgencia, imagemPath, status, ocorrenciaId];
      } else {
        query = 'UPDATE ocorrencias SET tipo = ?, descricao = ?, urgencia = ?, status = ? WHERE id = ?';
        params = [tipo, descricao, urgencia, status, ocorrenciaId];
      }

      db.query(query, params, (err, result) => {
        if (err) {
          console.error(err);
          return res.render('ocorrencias/editar', {
            title: 'Editar Ocorrência',
            user: req.session.user,
            ocorrencia: req.body,
            error: 'Erro ao atualizar ocorrência'
          });
        }
        
        res.redirect('/ocorrencias?success=Ocorrência atualizada com sucesso');
      });
    }
  );
});

// Rota para exibir o checklist
app.get('/checklist', requireAuth, (req, res) => {
  if (req.session.user.role === 'admin') {
    // Lógica para admin ver todos os checklists
    const hoje = new Date().toISOString().split('T')[0];
    
    db.query(
      `SELECT u.id as user_id, u.name as user_name, 
              c.id as checklist_id, c.data_criacao,
              c.epi1, c.epi2, c.maq1, c.maq2, c.area1, c.area2, c.observacoes
       FROM users u
       LEFT JOIN checklists c ON u.id = c.user_id AND DATE(c.data_criacao) = ?
       WHERE u.role = 'user'
       ORDER BY u.name`,
      [hoje],
      (err, results) => {
        if (err) {
          console.error(err);
          return res.status(500).send('Erro ao carregar checklists');
        }

        // Processar resultados para agrupar por usuário
        const usersChecklists = {};
        results.forEach(row => {
          if (!usersChecklists[row.user_id]) {
            usersChecklists[row.user_id] = {
              user_id: row.user_id,
              user_name: row.user_name,
              checklists: [],
              total: 0,
              concluidos: 0
            };
          }
          
          if (row.checklist_id) {
            usersChecklists[row.user_id].checklists.push(row);
            usersChecklists[row.user_id].total = 6; // Total de itens
            const concluidos = [
              row.epi1, row.epi2, row.maq1, row.maq2, row.area1, row.area2
            ].filter(Boolean).length;
            usersChecklists[row.user_id].concluidos += concluidos;
          }
        });

        res.render('admin-checklist', {
          title: 'Checklists dos Usuários',
          user: req.session.user,
          usersChecklists: Object.values(usersChecklists),
          hoje: hoje
        });
      }
    );
  } else {
    // Lógica original para usuários normais
    const hoje = new Date().toISOString().split('T')[0];
    
    db.query(
      'SELECT * FROM checklists WHERE user_id = ? AND DATE(data_criacao) = ?',
      [req.session.user.id, hoje],
      (err, results) => {
        if (err) {
          console.error(err);
          return res.status(500).send('Erro ao carregar checklist');
        }

        const checklist = results.length > 0 ? results[0] : null;
        
        res.render('checklist', {
          title: 'Checklist',
          user: req.session.user,
          checklist: checklist
        });
      }
    );
  }
});
// Rota para salvar o checklist
app.post('/checklist', requireAuth, (req, res) => {
  const { epi1, epi2, maq1, maq2, area1, area2, observacoes } = req.body;
  const userId = req.session.user.id;
  
  // Verifica se já existe um checklist hoje
  const hoje = new Date().toISOString().split('T')[0];
  
  db.query(
    'SELECT id FROM checklists WHERE user_id = ? AND DATE(data_criacao) = ?',
    [userId, hoje],
    (err, results) => {
      if (err) {
        console.error(err);
        return res.status(500).send('Erro ao verificar checklist');
      }

      if (results.length > 0) {
        // Atualiza checklist existente
        db.query(
          'UPDATE checklists SET epi1 = ?, epi2 = ?, maq1 = ?, maq2 = ?, area1 = ?, area2 = ?, observacoes = ? WHERE id = ?',
          [epi1 === 'on', epi2 === 'on', maq1 === 'on', maq2 === 'on', area1 === 'on', area2 === 'on', observacoes, results[0].id],
          (err, result) => {
            if (err) {
              console.error(err);
              return res.status(500).send('Erro ao atualizar checklist');
            }
            res.redirect('/?success=Checklist atualizado com sucesso');
          }
        );
      } else {
        // Cria novo checklist
        db.query(
          'INSERT INTO checklists (user_id, epi1, epi2, maq1, maq2, area1, area2, observacoes) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
          [userId, epi1 === 'on', epi2 === 'on', maq1 === 'on', maq2 === 'on', area1 === 'on', area2 === 'on', observacoes],
          (err, result) => {
            if (err) {
              console.error(err);
              return res.status(500).send('Erro ao salvar checklist');
            }
            res.redirect('/?success=Checklist salvo com sucesso');
          }
        );
      }
    }
  );
});





app.get('/conhecimento', requireAuth, (req, res) => {
  res.render('conhecimento', { 
    title: 'Banco de Conhecimento',
    user: req.session.user
  });
});

// Adicione estas rotas no app.js

// Rota para listar alertas (acessível a todos os usuários autenticados)
app.get('/alertas', requireAuth, (req, res) => {
  db.query(
    `SELECT a.*, u.name as user_name 
     FROM alertas a
     JOIN users u ON a.user_id = u.id
     ORDER BY a.data_criacao DESC`,
    (err, results) => {
      if (err) {
        console.error(err);
        return res.status(500).render('alertas', {
          title: 'Alertas',
          user: req.session.user,
          alertas: [], // Passa array vazio em caso de erro
          error: 'Erro ao carregar alertas'
        });
      }

      res.render('alertas', {
        title: 'Alertas',
        user: req.session.user,
        alertas: results || [], // Garante que sempre tenha um valor
        error: req.query.error,
        success: req.query.success
      });
    }
  );
});

// Rota para exibir formulário de novo alerta (apenas admin)
app.get('/alertas/novo', requireAdmin, (req, res) => {
  res.render('alertas/novo', {
    title: 'Novo Alerta',
    user: req.session.user
  });
});

// Rota para criar novo alerta (apenas admin)
app.post('/alertas', requireAdmin, (req, res) => {
  const { titulo, descricao, tipo, severidade } = req.body;
  const userId = req.session.user.id;

  db.query(
    'INSERT INTO alertas (user_id, titulo, descricao, tipo, severidade) VALUES (?, ?, ?, ?, ?)',
    [userId, titulo, descricao, tipo, severidade],
    (err, result) => {
      if (err) {
        console.error(err);
        return res.render('alertas/novo', {
          title: 'Novo Alerta',
          user: req.session.user,
          error: 'Erro ao criar alerta',
          formData: req.body
        });
      }
      res.redirect('/alertas?success=Alerta criado com sucesso');
    }
  );
});

// Rota para exibir formulário de edição (apenas admin)
app.get('/alertas/editar/:id', requireAdmin, (req, res) => {
  db.query(
    'SELECT * FROM alertas WHERE id = ?',
    [req.params.id],
    (err, results) => {
      if (err || results.length === 0) {
        console.error(err);
        return res.redirect('/alertas?error=Alerta não encontrado');
      }
      
      res.render('alertas/editar', {
        title: 'Editar Alerta',
        user: req.session.user,
        alerta: results[0]
      });
    }
  );
});

// Rota para atualizar alerta (apenas admin)
app.post('/alertas/editar/:id', requireAdmin, (req, res) => {
  const { titulo, descricao, tipo, severidade, status } = req.body;
  const alertaId = req.params.id;

  db.query(
    'UPDATE alertas SET titulo = ?, descricao = ?, tipo = ?, severidade = ?, status = ? WHERE id = ?',
    [titulo, descricao, tipo, severidade, status, alertaId],
    (err, result) => {
      if (err) {
        console.error(err);
        return res.render('alertas/editar', {
          title: 'Editar Alerta',
          user: req.session.user,
          alerta: req.body,
          error: 'Erro ao atualizar alerta'
        });
      }
      
      res.redirect('/alertas?success=Alerta atualizado com sucesso');
    }
  );
});

// Rota para excluir alerta (apenas admin)
app.post('/alertas/excluir/:id', requireAdmin, (req, res) => {
  db.query(
    'DELETE FROM alertas WHERE id = ?',
    [req.params.id],
    (err, result) => {
      if (err) {
        console.error(err);
        return res.redirect('/alertas?error=Erro ao excluir alerta');
      }
      
      res.redirect('/alertas?success=Alerta excluído com sucesso');
    }
  );
});

// Rota principal do chat
app.get('/chat', requireAuth, (req, res) => {
  // Busca todas as conversas do usuário
  db.query(
    `SELECT c.id, 
            u1.id as usuario1_id, u1.name as usuario1_name,
            u2.id as usuario2_id, u2.name as usuario2_name,
            (SELECT COUNT(*) FROM mensagens m WHERE m.conversa_id = c.id AND m.remetente_id != ? AND m.lida = FALSE) as nao_lidas
     FROM conversas c
     JOIN users u1 ON c.usuario1_id = u1.id
     JOIN users u2 ON c.usuario2_id = u2.id
     WHERE c.usuario1_id = ? OR c.usuario2_id = ?
     ORDER BY (SELECT MAX(data_envio) FROM mensagens m WHERE m.conversa_id = c.id) DESC`,
    [req.session.user.id, req.session.user.id, req.session.user.id],
    (err, conversasResults) => {
      if (err) {
        console.error(err);
        return res.status(500).send('Erro ao carregar conversas');
      }

      res.render('chat', {
        title: 'Chat',
        user: req.session.user,
        conversas: conversasResults
      });
    }
  );
});

// Rota para buscar usuários para nova conversa
app.get('/chat/buscar-usuarios', requireAuth, (req, res) => {
  const termo = req.query.termo || '';
  
  db.query(
    `SELECT id, name, email 
     FROM users 
     WHERE (name LIKE ? OR email LIKE ?) 
     AND id != ? 
     LIMIT 10`,
    [`%${termo}%`, `%${termo}%`, req.session.user.id],
    (err, results) => {
      if (err) {
        console.error(err);
        return res.status(500).json({ error: 'Erro na busca' });
      }
      
      res.json(results);
    }
  );
});

// Rota para iniciar nova conversa - ATUALIZADA
app.post('/chat/nova-conversa', requireAuth, express.json(), (req, res) => { // Adicione express.json()
  const { usuario_id } = req.body;
  
  if (!usuario_id) {
    return res.status(400).json({ error: 'ID do usuário é obrigatório' });
  }

  // Verifica se já existe conversa entre esses usuários
  db.query(
    `SELECT id FROM conversas 
     WHERE (usuario1_id = ? AND usuario2_id = ?) 
     OR (usuario1_id = ? AND usuario2_id = ?)`,
    [req.session.user.id, usuario_id, usuario_id, req.session.user.id],
    (err, results) => {
      if (err) {
        console.error(err);
        return res.status(500).json({ error: 'Erro ao verificar conversa' });
      }
      
      if (results.length > 0) {
        // Conversa já existe - redireciona para ela
        return res.json({ conversa_id: results[0].id });
      }
      
      // Cria nova conversa
      const usuario1_id = Math.min(req.session.user.id, usuario_id);
      const usuario2_id = Math.max(req.session.user.id, usuario_id);
      
      db.query(
        'INSERT INTO conversas (usuario1_id, usuario2_id) VALUES (?, ?)',
        [usuario1_id, usuario2_id],
        (err, result) => {
          if (err) {
            console.error(err);
            return res.status(500).json({ error: 'Erro ao criar conversa' });
          }
          
          res.json({ conversa_id: result.insertId });
        }
      );
    }
  );
});
// Rota para visualizar uma conversa específica
app.get('/chat/conversa/:id', requireAuth, (req, res) => {
  // Verifica se o usuário tem permissão para acessar esta conversa
  db.query(
    `SELECT c.id, 
            u1.id as usuario1_id, u1.name as usuario1_name,
            u2.id as usuario2_id, u2.name as usuario2_name
     FROM conversas c
     JOIN users u1 ON c.usuario1_id = u1.id
     JOIN users u2 ON c.usuario2_id = u2.id
     WHERE c.id = ? AND (c.usuario1_id = ? OR c.usuario2_id = ?)`,
    [req.params.id, req.session.user.id, req.session.user.id],
    (err, results) => {
      if (err || results.length === 0) {
        console.error(err);
        return res.status(403).send('Conversa não encontrada');
      }
      
      const conversa = results[0];
      const outroUsuarioId = conversa.usuario1_id === req.session.user.id ? 
                            conversa.usuario2_id : conversa.usuario1_id;
      const outroUsuarioNome = conversa.usuario1_id === req.session.user.id ? 
                             conversa.usuario2_name : conversa.usuario1_name;
      
      // Busca as mensagens
      db.query(
        `SELECT m.*, u.name as remetente_name 
         FROM mensagens m
         JOIN users u ON m.remetente_id = u.id
         WHERE m.conversa_id = ?
         ORDER BY m.data_envio ASC`,
        [req.params.id],
        (err, mensagensResults) => {
          if (err) {
            console.error(err);
            return res.status(500).send('Erro ao carregar mensagens');
          }
          
          // Marca mensagens como lidas
          db.query(
            'UPDATE mensagens SET lida = TRUE WHERE conversa_id = ? AND remetente_id != ? AND lida = FALSE',
            [req.params.id, req.session.user.id],
            (err) => {
              if (err) console.error('Erro ao marcar mensagens como lidas:', err);
              
              res.render('chat-conversa', {
                title: `Chat com ${outroUsuarioNome}`,
                user: req.session.user,
                conversa: conversa,
                outroUsuarioId: outroUsuarioId,
                outroUsuarioNome: outroUsuarioNome,
                mensagens: mensagensResults
              });
            }
          );
        }
      );
    }
  );
});

// Rota para enviar mensagem
app.post('/chat/enviar-mensagem', requireAuth, (req, res) => {
  const { conversa_id, mensagem } = req.body;
  
  // Verifica se o usuário tem permissão para enviar mensagem nesta conversa
  db.query(
    'SELECT id FROM conversas WHERE id = ? AND (usuario1_id = ? OR usuario2_id = ?)',
    [conversa_id, req.session.user.id, req.session.user.id],
    (err, results) => {
      if (err || results.length === 0) {
        console.error(err);
        return res.status(403).json({ error: 'Conversa não encontrada' });
      }
      
      // Insere a mensagem
      db.query(
        'INSERT INTO mensagens (conversa_id, remetente_id, mensagem) VALUES (?, ?, ?)',
        [conversa_id, req.session.user.id, mensagem],
        (err, result) => {
          if (err) {
            console.error(err);
            return res.status(500).json({ error: 'Erro ao enviar mensagem' });
          }
          
          res.json({ success: true });
        }
      );
    }
  );
});

// Rota para verificar novas mensagens
app.get('/chat/verificar-mensagens/:conversa_id', requireAuth, (req, res) => {
  db.query(
    `SELECT m.*, u.name as remetente_name 
     FROM mensagens m
     JOIN users u ON m.remetente_id = u.id
     WHERE m.conversa_id = ? AND m.remetente_id != ? AND m.lida = FALSE
     ORDER BY m.data_envio ASC`,
    [req.params.conversa_id, req.session.user.id],
    (err, results) => {
      if (err) {
        console.error(err);
        return res.status(500).json({ error: 'Erro ao verificar mensagens' });
      }
      
      // Marca como lidas
      if (results.length > 0) {
        db.query(
          'UPDATE mensagens SET lida = TRUE WHERE conversa_id = ? AND remetente_id != ? AND lida = FALSE',
          [req.params.conversa_id, req.session.user.id],
          (err) => {
            if (err) console.error('Erro ao marcar mensagens como lidas:', err);
          }
        );
      }
      
      res.json(results);
    }
  );
});

// Rota para admin ver detalhes do checklist de um usuário
app.get('/admin/checklist/:user_id', requireAdmin, (req, res) => {
  const hoje = new Date().toISOString().split('T')[0];
  
  db.query(
    `SELECT u.name as user_name, c.* 
     FROM checklists c
     JOIN users u ON c.user_id = u.id
     WHERE c.user_id = ? AND DATE(c.data_criacao) = ?`,
    [req.params.user_id, hoje],
    (err, results) => {
      if (err) {
        console.error(err);
        return res.status(500).send('Erro ao carregar checklist');
      }

      if (results.length === 0) {
        // Buscar apenas o nome do usuário
        db.query(
          'SELECT name as user_name FROM users WHERE id = ?',
          [req.params.user_id],
          (err, userResults) => {
            if (err || userResults.length === 0) {
              return res.status(404).send('Usuário não encontrado');
            }
            
            res.render('checklist', {
              title: 'Checklist de ' + userResults[0].user_name,
              user: req.session.user,
              checklist: null,
              isAdminView: true,
              viewedUser: userResults[0]
            });
          }
        );
      } else {
        res.render('checklist', {
          title: 'Checklist de ' + results[0].user_name,
          user: req.session.user,
          checklist: results[0],
          isAdminView: true,
          viewedUser: { user_name: results[0].user_name }
        });
      }
    }
  );
});


// Painel de administração
app.get('/admin', requireAdmin, (req, res) => {
  res.render('admin/dashboard', {
    title: 'Painel de Administração',
    user: req.session.user
  });
});


// Rota para promover usuário a admin (acessível apenas por admins)
app.post('/admin/promote/:user_id', requireAdmin, (req, res) => {
  db.query(
    'UPDATE users SET role = "admin" WHERE id = ?',
    [req.params.user_id],
    (err, result) => {
      if (err) {
        console.error(err);
        return res.status(500).json({ error: 'Erro ao promover usuário' });
      }
      
      res.json({ success: true });
    }
  );
});


// Rota para listar usuários (admin)
app.get('/admin/usuarios', requireAdmin, (req, res) => {
  db.query(
    'SELECT id, name, email, role FROM users ORDER BY name',
    (err, results) => {
      if (err) {
        console.error(err);
        return res.status(500).send('Erro ao carregar usuários');
      }
      
      res.render('admin/usuarios', {
        title: 'Gerenciar Usuários',
        user: req.session.user,
        usuarios: results
      });
    }
  );
});

// Rota para admin ver todas as ocorrências
app.get('/admin/ocorrencias', requireAdmin, (req, res) => {
  db.query(
    `SELECT o.*, u.name as user_name 
     FROM ocorrencias o
     JOIN users u ON o.user_id = u.id
     ORDER BY o.data_criacao DESC`,
    (err, results) => {
      if (err) {
        console.error(err);
        return res.status(500).render('admin/ocorrencias', {
          title: 'Todas as Ocorrências',
          user: req.session.user,
          ocorrencias: [],
          error: 'Erro ao carregar ocorrências'
        });
      }

      res.render('admin/ocorrencias', {
        title: 'Todas as Ocorrências',
        user: req.session.user,
        ocorrencias: results,
        error: req.query.error,
        success: req.query.success
      });
    }
  );
});

// Iniciar servidor
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Servidor rodando em http://localhost:${PORT}`);
});