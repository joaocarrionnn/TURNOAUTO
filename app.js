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

function renderDashboardWithDefaults(res, user) {
  res.render('dashboard', {
    title: 'Dashboard',
    user: user,
    totalOcorrencias: 0,
    ocorrencias: [],
    checklist: null,
    alertas: 0
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
        
        // Continua com as outras consultas (ocorrências, etc)
        db.query(
          'SELECT COUNT(*) as total FROM ocorrencias WHERE user_id = ?',
          [req.session.user.id],
          (err, countResults) => {
            if (err) {
              console.error('Erro ao contar ocorrências:', err);
              return renderDashboardWithDefaults(res, req.session.user);
            }

            db.query(
              'SELECT * FROM ocorrencias WHERE user_id = ? ORDER BY data_criacao DESC LIMIT 5',
              [req.session.user.id],
              (err, ocorrenciasResults) => {
                if (err) {
                  console.error('Erro ao buscar ocorrências:', err);
                  return renderDashboardWithDefaults(res, req.session.user);
                }

                res.render('dashboard', {
                  title: 'Dashboard',
                  user: req.session.user,
                  totalOcorrencias: countResults[0].total,
                  ocorrencias: ocorrenciasResults || [],
                  checklist: checklist,
                  alertas: 2
                });
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
        email: email // Mantém o email preenchido
      });
    }
    
    if (results.length === 0) {
      return res.render('auth/login', {
        title: 'Login',
        error: 'Email ou senha incorretos',
        email: email // Mantém o email preenchido
      });
    }
    
    const user = results[0];
    
    bcrypt.compare(password, user.password, (err, isMatch) => {
      if (err || !isMatch) {
        return res.render('auth/login', {
          title: 'Login',
          error: 'Email ou senha incorretos',
          email: email // Mantém o email preenchido
        });
      }
      
      req.session.user = {
        id: user.id,
        name: user.name,
        email: user.email
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
      
      // Inserir novo usuário
      db.query(
        'INSERT INTO users (name, email, password) VALUES (?, ?, ?)',
        [name, email, hash],
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
    'SELECT * FROM ocorrencias WHERE user_id = ? ORDER BY data_criacao DESC',
    [req.session.user.id],
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

// Rota para exibir o formulário de edição
app.get('/ocorrencias/editar/:id', requireAuth, (req, res) => {
  db.query(
    'SELECT * FROM ocorrencias WHERE id = ? AND user_id = ?',
    [req.params.id, req.session.user.id],
    (err, results) => {
      if (err || results.length === 0) {
        console.error(err);
        return res.redirect('/ocorrencias?error=Ocorrência não encontrada');
      }
      
      res.render('ocorrencias/editar', {
        title: 'Editar Ocorrência',
        user: req.session.user,
        ocorrencia: results[0]
      });
    }
  );
});

// Rota para processar a edição
app.post('/ocorrencias/editar/:id', requireAuth, upload.single('imagem'), (req, res) => {
  const { tipo, descricao, urgencia, status } = req.body;
  const userId = req.session.user.id;
  const ocorrenciaId = req.params.id;
  
  let imagemPath = null;
  if (req.file) {
    imagemPath = '/uploads/' + req.file.filename;
  }

  // Se não enviou nova imagem, mantém a existente
  let query;
  let params;
  
  if (imagemPath) {
    query = 'UPDATE ocorrencias SET tipo = ?, descricao = ?, urgencia = ?, imagem = ?, status = ? WHERE id = ? AND user_id = ?';
    params = [tipo, descricao, urgencia, imagemPath, status, ocorrenciaId, userId];
  } else {
    query = 'UPDATE ocorrencias SET tipo = ?, descricao = ?, urgencia = ?, status = ? WHERE id = ? AND user_id = ?';
    params = [tipo, descricao, urgencia, status, ocorrenciaId, userId];
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
});

// Rota para exibir o checklist
app.get('/checklist', requireAuth, (req, res) => {
  // Verifica se já existe um checklist hoje
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

app.get('/alertas', requireAuth, (req, res) => {
  res.render('alertas', { 
    title: 'Alertas',
    user: req.session.user
  });
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

// Iniciar servidor
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Servidor rodando em http://localhost:${PORT}`);
});