
/* O navegador conversa com Flask. Somente Python conhece a chave do Supabase.
   async permite usar await para aguardar a resposta de uma requisição. */
const formularioProduto = document.getElementById("formulario-produto");
const mensagem = document.getElementById("mensagem");
const mensagemLista = document.getElementById("mensagem-lista");
const lista = document.getElementById("lista-produtos");
const campoCategoria = document.getElementById("categoria");
const botaoCadastrar = document.getElementById("botao-cadastrar-produto");
const formularioContato = document.getElementById("form-cadastro");
const mensagemCadastro = document.getElementById("mensagem-cadastro");
const clienteCarrinho = document.getElementById("cliente-carrinho");
const produtoCarrinho = document.getElementById("produto-carrinho");
const quantidadeCarrinho = document.getElementById("quantidade-carrinho");
const listaCarrinho = document.getElementById("lista-carrinho");
const mensagemCarrinho = document.getElementById("mensagem-carrinho");
const botaoAdicionarCarrinho = document.getElementById("botao-adicionar-carrinho");

function mostrarMensagem(texto, sucesso) {
  mensagem.textContent = texto;
  mensagem.className = sucesso ? "mensagem sucesso" : "mensagem erro";
}

function mostrarMensagemCarrinho(texto, sucesso) {
  mensagemCarrinho.textContent = texto;
  mensagemCarrinho.className = sucesso ? "mensagem sucesso" : "mensagem erro";
}

async function carregarCategorias() {
  try {
    const resposta = await fetch("/api/categorias");
    const dados = await resposta.json();
    if (!resposta.ok) {
      mostrarMensagem(dados.mensagem, false);
      return;
    }
    for (const categoria of dados) {
      const opcao = document.createElement("option");
      opcao.value = categoria.categoria_id;
      opcao.textContent = categoria.nome;
      campoCategoria.appendChild(opcao);
    }
    if (dados.length === 0) {
      mostrarMensagem("Cadastre as categorias executando o SQL da aula.", false);
    }
  } catch (erro) {
    mostrarMensagem("Não foi possível carregar as categorias. Confira o servidor.", false);
  }
}

async function carregarProdutos() {
  mensagemLista.textContent = "Consultando produtos...";
  try {
    const resposta = await fetch("/api/produtos");
    const produtos = await resposta.json();
    if (!resposta.ok) {
      mensagemLista.textContent = produtos.mensagem;
      return;
    }

    produtoCarrinho.replaceChildren();
    const opcaoPadrao = document.createElement("option");
    opcaoPadrao.value = "";
    opcaoPadrao.textContent = "Selecione um produto";
    produtoCarrinho.appendChild(opcaoPadrao);

    lista.replaceChildren();
    for (const produto of produtos) {
      const linha = document.createElement("tr");
      const valores = [
        produto.nome,
        produto.categorias ? produto.categorias.nome : "Sem categoria",
        Number(produto.preco).toLocaleString("pt-BR", { style: "currency", currency: "BRL" }),
        produto.estoque,
      ];
      for (const valor of valores) {
        const celula = document.createElement("td");
        celula.textContent = valor;
        linha.appendChild(celula);
      }
      lista.appendChild(linha);

      const opcao = document.createElement("option");
      opcao.value = produto.produto_id;
      opcao.textContent = `${produto.nome} - ${Number(produto.preco).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}`;
      produtoCarrinho.appendChild(opcao);
    }
    mensagemLista.textContent = produtos.length === 0 ? "Nenhum produto cadastrado." : "Lista atualizada.";
  } catch (erro) {
    mensagemLista.textContent = "Não foi possível atualizar a lista. Confira o servidor.";
  }
}

async function carregarClientes() {
  try {
    const resposta = await fetch("/api/clientes");
    const clientes = await resposta.json();
    if (!resposta.ok) {
      mostrarMensagemCarrinho(clientes.mensagem || "Não foi possível carregar clientes.", false);
      return;
    }

    clienteCarrinho.replaceChildren();
    const opcaoPadrao = document.createElement("option");
    opcaoPadrao.value = "";
    opcaoPadrao.textContent = "Selecione um cliente";
    clienteCarrinho.appendChild(opcaoPadrao);

    for (const cliente of clientes) {
      const opcao = document.createElement("option");
      opcao.value = cliente.cliente_id;
      opcao.textContent = `${cliente.nome} · ${cliente.email}`;
      clienteCarrinho.appendChild(opcao);
    }
  } catch (erro) {
    mostrarMensagemCarrinho("Não foi possível carregar os clientes cadastrados.", false);
  }
}

async function carregarCarrinho() {
  const clienteId = clienteCarrinho.value;
  if (!clienteId) {
    listaCarrinho.innerHTML = '<tr><td colspan="5">Selecione um cliente cadastrado para ver o carrinho.</td></tr>';
    return;
  }

  try {
    const resposta = await fetch(`/api/carrinho?cliente_id=${clienteId}`);
    const dados = await resposta.json();

    if (!resposta.ok) {
      mostrarMensagemCarrinho(dados.mensagem, false);
      listaCarrinho.innerHTML = '<tr><td colspan="5">Carrinho indisponível para esse cliente.</td></tr>';
      return;
    }

    if (!dados.length) {
      listaCarrinho.innerHTML = '<tr><td colspan="5">Nenhum item no carrinho para esse cliente.</td></tr>';
      mostrarMensagemCarrinho("Carrinho vazio para o cliente selecionado.", true);
      return;
    }

    listaCarrinho.replaceChildren();
    let total = 0;
    for (const item of dados) {
      const linha = document.createElement("tr");
      const produto = item.produtos || {};
      const preco = Number(produto.preco || 0);
      const quantidade = Number(item.quantidade || 0);
      const subtotal = preco * quantidade;
      total += subtotal;

      linha.innerHTML = `
        <td>${produto.nome || "Produto"}</td>
        <td>${quantidade}</td>
        <td>${preco.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}</td>
        <td>${subtotal.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}</td>
        <td><button type="button" class="botao-remover" data-carrinho-id="${item.carrinho_id}">Remover</button></td>
      `;
      listaCarrinho.appendChild(linha);
    }

    const linhaTotal = document.createElement("tr");
    linhaTotal.innerHTML = `<td colspan="3"><strong>Total</strong></td><td colspan="2"><strong>${total.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}</strong></td>`;
    listaCarrinho.appendChild(linhaTotal);
    mostrarMensagemCarrinho("Carrinho atualizado.", true);
  } catch (erro) {
    mostrarMensagemCarrinho("Não foi possível carregar o carrinho.", false);
  }
}

async function cadastrarProduto(evento) {
  evento.preventDefault();
  botaoCadastrar.disabled = true;
  mostrarMensagem("Enviando dados...", true);

  const produto = {
    nome: document.getElementById("produto-nome").value,
    categoria_id: campoCategoria.value,
    preco: document.getElementById("preco").value,
    estoque: document.getElementById("estoque").value,
  };

  try {
    const resposta = await fetch("/api/produtos", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(produto),
    });
    const dados = await resposta.json();
    mostrarMensagem(dados.mensagem, resposta.ok);
    if (resposta.ok) {
      formularioProduto.reset();
      await carregarProdutos();
    }
  } catch (erro) {
    mostrarMensagem("Não foi possível confirmar o cadastro. Atualize a lista antes de reenviar.", false);
  } finally {
    botaoCadastrar.disabled = false;
  }
}

async function cadastrarCliente(evento) {
  evento.preventDefault();

  const dadosCliente = {
    nome: document.getElementById("contato-nome").value.trim(),
    telefone: document.getElementById("contato-telefone").value.trim(),
    email: document.getElementById("contato-email").value.trim(),
  };

  if (!dadosCliente.nome || !dadosCliente.telefone || !dadosCliente.email) {
    mensagemCadastro.textContent = "Preencha nome, telefone e e-mail.";
    mensagemCadastro.className = "mensagem erro";
    return;
  }

  try {
    const resposta = await fetch("/api/clientes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(dadosCliente),
    });
    const dados = await resposta.json();
    mensagemCadastro.textContent = dados.mensagem;
    mensagemCadastro.className = resposta.ok ? "mensagem sucesso" : "mensagem erro";

    if (resposta.ok) {
      formularioContato.reset();
      await carregarClientes();
    }
  } catch (erro) {
    mensagemCadastro.textContent = "Não foi possível cadastrar o cliente.";
    mensagemCadastro.className = "mensagem erro";
  }
}

async function adicionarAoCarrinho() {
  const clienteId = clienteCarrinho.value;
  const produtoId = produtoCarrinho.value;
  const quantidade = Number(quantidadeCarrinho.value || 0);

  // LIMITE: cliente não cadastrado não entra no carrinho. O select só aceita clientes válidos e a API também valida esse critério.
  if (!clienteId) {
    mostrarMensagemCarrinho("Selecione um cliente cadastrado para usar o carrinho.", false);
    return;
  }

  if (!produtoId) {
    mostrarMensagemCarrinho("Selecione um produto para adicionar ao carrinho.", false);
    return;
  }

  if (!Number.isInteger(quantidade) || quantidade <= 0) {
    mostrarMensagemCarrinho("Informe uma quantidade válida.", false);
    return;
  }

  try {
    const resposta = await fetch("/api/carrinho", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        cliente_id: clienteId,
        produto_id: produtoId,
        quantidade,
      }),
    });
    const dados = await resposta.json();
    mostrarMensagemCarrinho(dados.mensagem, resposta.ok);

    if (resposta.ok) {
      quantidadeCarrinho.value = 1;
      await carregarCarrinho();
    }
  } catch (erro) {
    mostrarMensagemCarrinho("Não foi possível adicionar o produto ao carrinho.", false);
  }
}

async function removerDoCarrinho(evento) {
  const botao = evento.target.closest(".botao-remover");
  if (!botao) {
    return;
  }

  const clienteId = clienteCarrinho.value;
  const carrinhoId = botao.dataset.carrinhoId;
  if (!clienteId || !carrinhoId) {
    mostrarMensagemCarrinho("Selecione um cliente cadastrado e um item válido.", false);
    return;
  }

  try {
    const resposta = await fetch("/api/carrinho", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ cliente_id: clienteId, carrinho_id: Number(carrinhoId) }),
    });
    const dados = await resposta.json();
    mostrarMensagemCarrinho(dados.mensagem, resposta.ok);
    if (resposta.ok) {
      await carregarCarrinho();
    }
  } catch (erro) {
    mostrarMensagemCarrinho("Não foi possível remover o item do carrinho.", false);
  }
}

formularioContato.addEventListener("submit", cadastrarCliente);
formularioProduto.addEventListener("submit", cadastrarProduto);
clienteCarrinho.addEventListener("change", carregarCarrinho);
botaoAdicionarCarrinho.addEventListener("click", adicionarAoCarrinho);
listaCarrinho.addEventListener("click", removerDoCarrinho);
document.getElementById("botao-atualizar").addEventListener("click", carregarProdutos);

carregarCategorias();
carregarProdutos();
carregarClientes();
carregarCarrinho();