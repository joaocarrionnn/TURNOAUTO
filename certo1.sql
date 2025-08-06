-- --------------------------------------------------------
-- Servidor:                     127.0.0.1
-- Versão do servidor:           10.4.32-MariaDB - mariadb.org binary distribution
-- OS do Servidor:               Win64
-- HeidiSQL Versão:              12.11.0.7065
-- --------------------------------------------------------

/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET NAMES utf8 */;
/*!50503 SET NAMES utf8mb4 */;
/*!40103 SET @OLD_TIME_ZONE=@@TIME_ZONE */;
/*!40103 SET TIME_ZONE='+00:00' */;
/*!40014 SET @OLD_FOREIGN_KEY_CHECKS=@@FOREIGN_KEY_CHECKS, FOREIGN_KEY_CHECKS=0 */;
/*!40101 SET @OLD_SQL_MODE=@@SQL_MODE, SQL_MODE='NO_AUTO_VALUE_ON_ZERO' */;
/*!40111 SET @OLD_SQL_NOTES=@@SQL_NOTES, SQL_NOTES=0 */;


-- Copiando estrutura do banco de dados para auth_system
CREATE DATABASE IF NOT EXISTS `auth_system` /*!40100 DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci */;
USE `auth_system`;

-- Copiando estrutura para tabela auth_system.alertas
CREATE TABLE IF NOT EXISTS `alertas` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `user_id` int(11) NOT NULL,
  `titulo` varchar(255) NOT NULL,
  `descricao` text NOT NULL,
  `tipo` varchar(50) NOT NULL,
  `severidade` enum('crítica','alta','média','baixa') NOT NULL,
  `status` enum('ativo','resolvido','cancelado') NOT NULL DEFAULT 'ativo',
  `data_criacao` timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `user_id` (`user_id`),
  CONSTRAINT `alertas_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=2 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- Copiando dados para a tabela auth_system.alertas: ~1 rows (aproximadamente)
INSERT INTO `alertas` (`id`, `user_id`, `titulo`, `descricao`, `tipo`, `severidade`, `status`, `data_criacao`) VALUES
	(1, 6, 'aaa', 'aaa', 'Outro', 'crítica', 'ativo', '2025-08-06 13:11:30');

-- Copiando estrutura para tabela auth_system.checklists
CREATE TABLE IF NOT EXISTS `checklists` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `user_id` int(11) NOT NULL,
  `epi1` tinyint(1) DEFAULT 0,
  `epi2` tinyint(1) DEFAULT 0,
  `maq1` tinyint(1) DEFAULT 0,
  `maq2` tinyint(1) DEFAULT 0,
  `area1` tinyint(1) DEFAULT 0,
  `area2` tinyint(1) DEFAULT 0,
  `observacoes` text DEFAULT NULL,
  `data_criacao` timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `user_id` (`user_id`),
  CONSTRAINT `checklists_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=5 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- Copiando dados para a tabela auth_system.checklists: ~4 rows (aproximadamente)
INSERT INTO `checklists` (`id`, `user_id`, `epi1`, `epi2`, `maq1`, `maq2`, `area1`, `area2`, `observacoes`, `data_criacao`) VALUES
	(1, 1, 1, 0, 0, 0, 0, 0, '', '2025-06-27 19:32:26'),
	(2, 3, 1, 1, 0, 0, 1, 1, '', '2025-07-30 16:46:34'),
	(3, 6, 0, 0, 0, 0, 1, 0, '', '2025-07-30 17:21:12'),
	(4, 2, 0, 1, 1, 1, 1, 1, '', '2025-07-30 18:57:10');

-- Copiando estrutura para tabela auth_system.conversas
CREATE TABLE IF NOT EXISTS `conversas` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `usuario1_id` int(11) NOT NULL,
  `usuario2_id` int(11) NOT NULL,
  `data_criacao` datetime DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  UNIQUE KEY `unique_conversa` (`usuario1_id`,`usuario2_id`),
  KEY `usuario2_id` (`usuario2_id`),
  CONSTRAINT `conversas_ibfk_1` FOREIGN KEY (`usuario1_id`) REFERENCES `users` (`id`),
  CONSTRAINT `conversas_ibfk_2` FOREIGN KEY (`usuario2_id`) REFERENCES `users` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=5 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- Copiando dados para a tabela auth_system.conversas: ~4 rows (aproximadamente)
INSERT INTO `conversas` (`id`, `usuario1_id`, `usuario2_id`, `data_criacao`) VALUES
	(1, 1, 2, '2025-06-27 15:58:22'),
	(2, 1, 3, '2025-07-30 10:15:08'),
	(3, 3, 6, '2025-07-30 14:27:53'),
	(4, 2, 3, '2025-08-06 09:54:11');

-- Copiando estrutura para tabela auth_system.mensagens
CREATE TABLE IF NOT EXISTS `mensagens` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `conversa_id` int(11) NOT NULL,
  `remetente_id` int(11) NOT NULL,
  `mensagem` text NOT NULL,
  `data_envio` datetime DEFAULT current_timestamp(),
  `lida` tinyint(1) DEFAULT 0,
  PRIMARY KEY (`id`),
  KEY `conversa_id` (`conversa_id`),
  KEY `remetente_id` (`remetente_id`),
  CONSTRAINT `mensagens_ibfk_1` FOREIGN KEY (`conversa_id`) REFERENCES `conversas` (`id`),
  CONSTRAINT `mensagens_ibfk_2` FOREIGN KEY (`remetente_id`) REFERENCES `users` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=9 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- Copiando dados para a tabela auth_system.mensagens: ~8 rows (aproximadamente)
INSERT INTO `mensagens` (`id`, `conversa_id`, `remetente_id`, `mensagem`, `data_envio`, `lida`) VALUES
	(1, 1, 1, 'otario', '2025-06-27 15:58:26', 1),
	(2, 1, 2, 'troxa', '2025-06-27 15:59:01', 1),
	(3, 1, 1, 'aoba', '2025-06-27 16:10:46', 1),
	(4, 1, 2, 'cabeçudo', '2025-06-27 16:29:40', 1),
	(5, 2, 3, 'otario', '2025-07-30 10:15:11', 0),
	(6, 2, 3, '🐿️', '2025-07-30 10:21:41', 0),
	(7, 3, 6, 'otario', '2025-07-30 14:27:57', 1),
	(8, 2, 3, 'a', '2025-08-06 09:10:51', 0);

-- Copiando estrutura para tabela auth_system.ocorrencias
CREATE TABLE IF NOT EXISTS `ocorrencias` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `user_id` int(11) NOT NULL,
  `tipo` varchar(50) NOT NULL,
  `descricao` text NOT NULL,
  `urgencia` enum('baixa','media','alta') NOT NULL,
  `imagem` varchar(255) DEFAULT NULL,
  `status` enum('pendente','em_andamento','resolvido') NOT NULL DEFAULT 'pendente',
  `data_criacao` timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `user_id` (`user_id`),
  CONSTRAINT `ocorrencias_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=6 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- Copiando dados para a tabela auth_system.ocorrencias: ~5 rows (aproximadamente)
INSERT INTO `ocorrencias` (`id`, `user_id`, `tipo`, `descricao`, `urgencia`, `imagem`, `status`, `data_criacao`) VALUES
	(1, 3, 'Segurança', 'ferro a porta\r\n', 'alta', NULL, 'pendente', '2025-07-30 16:32:03'),
	(2, 3, 'manutencao', 'fudeu', 'media', NULL, 'resolvido', '2025-07-30 18:33:14'),
	(3, 2, 'manutencao', 'sada', 'alta', NULL, 'resolvido', '2025-07-30 18:57:24'),
	(4, 3, 'Limpeza', 'ada', 'baixa', '/uploads/9b5720ae634a51c5a0a6f5eff6dacbe2', 'em_andamento', '2025-08-06 11:34:04'),
	(5, 3, 'manutencao', 'a', 'alta', NULL, 'resolvido', '2025-08-06 13:10:31');

-- Copiando estrutura para tabela auth_system.users
CREATE TABLE IF NOT EXISTS `users` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `name` varchar(255) NOT NULL,
  `email` varchar(255) NOT NULL,
  `password` varchar(255) NOT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `role` enum('user','admin') DEFAULT 'user',
  `profile_picture` varchar(255) DEFAULT '/images/default-profile.png',
  PRIMARY KEY (`id`),
  UNIQUE KEY `email` (`email`)
) ENGINE=InnoDB AUTO_INCREMENT=7 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- Copiando dados para a tabela auth_system.users: ~6 rows (aproximadamente)
INSERT INTO `users` (`id`, `name`, `email`, `password`, `created_at`, `role`, `profile_picture`) VALUES
	(1, 'poli', 'poli@22', '$2b$10$9opkPEGJHtA57iBeocnrOuC8lUHApWdJexz8miM4KhwmAjFwLMYvq', '2025-06-27 18:56:20', 'user', '/images/default-profile.png'),
	(2, 'jao', 'jao@22', '$2b$10$lucItSd7H/Fm.VnNmcVTqukmwXjROBuAyZhcUggEvcl2KKXEVx/hy', '2025-06-27 18:58:10', 'user', '/images/default-profile.png'),
	(3, 'joao', 'jao@23', '$2b$10$phGLGQpr6wqFr/WRE6ReL.d5qGdzeNaQ.y7UyNgQ65xanX78Qcc5.', '2025-07-30 13:06:08', 'user', '/uploads/e44ba09ce2b2ca220fda2d7b5a66ee73'),
	(4, 'Admin', 'admin@23', '12345678', '2025-07-30 16:51:03', 'admin', '/images/default-profile.png'),
	(5, 'Admin', 'jao@admin', '12345678', '2025-07-30 17:13:20', 'admin', '/images/default-profile.png'),
	(6, 'policarpio', 'poli@23', '$2b$10$IxL4QdW4eIPiZmwFsaOqYuQPt1riFsAhceGNM1RbF5VcuLnEYXd..', '2025-07-30 17:16:23', 'admin', '/images/default-profile.png');

/*!40103 SET TIME_ZONE=IFNULL(@OLD_TIME_ZONE, 'system') */;
/*!40101 SET SQL_MODE=IFNULL(@OLD_SQL_MODE, '') */;
/*!40014 SET FOREIGN_KEY_CHECKS=IFNULL(@OLD_FOREIGN_KEY_CHECKS, 1) */;
/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40111 SET SQL_NOTES=IFNULL(@OLD_SQL_NOTES, 1) */;
