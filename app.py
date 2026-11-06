import os
from decimal import Decimal, InvalidOperation

import requests
from dotenv import load_dotenv
from flask import Flask, jsonify, render_template, request


load_dotenv()

app = Flask(__name__)
SUPABASE_URL = os.getenv("SUPABASE_URL", "").rstrip("/")
SUPABASE_SECRET_KEY = os.getenv("SUPABASE_SECRET_KEY", "")


def acessar_supabase(metodo, tabela, parametros=None, dados=None):
    resposta = requests.request(
        metodo,
        f"{SUPABASE_URL}/rest/v1/{tabela}",
        headers={
            "apikey": SUPABASE_SECRET_KEY,
            "content-type": "application/json",
            "prefer": "return=representation",
        },
        params=parametros,
        json=dados,
        timeout=10,
    )

    resposta.raise_for_status()
    return resposta.json()


@app.before_request
def conferir_configuracao():
    if request.path.startswith("/api/"):
        if not SUPABASE_URL or not SUPABASE_SECRET_KEY:
            return jsonify(mensagem="configure a url e a chave do supabase"), 503


@app.get("/")
def inicio():
    return render_template("index.html")

@app.get("/api/categorias")
def listar_catgorias():
    categorias = acessar_supabase(
        "GET",
        "categorias",
        {"select": "categoria_id,nome", "order": "nome.asc"},
    )
    return jsonify(categorias)

#listando produtos
@app.get("/api/produtos")
def listar_produto():
    produtos = acessar_supabase(
        "GET",
        "produtos",
        {"select": "produto_id, nome, preco, estoque, categorias(nome)", "order": "produto_id.desc"},
    )
    return jsonify(produtos)


@app.post("/api/produtos")
def cadastrar_produto():
    dados = request.get_json(silent=True)
    if not isinstance(dados, dict):
        return jsonify(mensagem="Envie um objeto JSON válido."), 400

    campos = ["nome", "preco", "estoque", "categoria_id"]
    for campo in campos:
        if dados.get(campo) is None or not isinstance(dados.get(campo), str):
            return jsonify(mensagem=f"O campo {campo} deve ser preenchido com texto"), 400

    nome = dados["nome"].strip()
    texto_preco = dados["preco"].strip().replace(",", ".")
    texto_estoque = dados["estoque"].strip()
    texto_categoria = dados["categoria_id"].strip()

    if len(nome) < 3 or len(nome) > 80:
        return jsonify(mensagem="Nome deve ter de 3 a 80 caracteres"), 400

    try:
        preco = Decimal(texto_preco)
        estoque = int(texto_estoque)
        categoria_id = int(texto_categoria)
    except (InvalidOperation, ValueError):
        return jsonify(mensagem="Informe preço numérico, estoque inteiro e categoria válida!"), 400

    if not preco.is_finite() or preco <= 0 or preco > Decimal("999999.99"):
        return jsonify(mensagem="o preço deve estar entre R$ 0,01 e R$ 999999,99"), 400
    if preco != preco.quantize(Decimal("0.01")):
        return jsonify(mensagem="o preço deve ter no máximo duas casas decimais"), 400
    if estoque < 0 or estoque > 1000000:
        return jsonify(mensagem="o Estoque deve estar entre 0 e 1000000 unidades"), 400
    if categoria_id <= 0 or categoria_id > 2147483647:
        return jsonify(mensagem="selecione uma categoria valida"), 400

    categorias = acessar_supabase(
        "GET",
        "categorias",
        {"select": "categoria_id", "categoria_id": f"eq.{categoria_id}"},
    )
    if not categorias:
        return jsonify(mensagem="a categoria informada não existe "), 400

    acessar_supabase(
        "POST",
        "produtos",
        dados={
            "nome": nome,
            "preco": str(preco),
            "estoque": estoque,
            "categoria_id": categoria_id,
        },
    )

    return jsonify(mensagem="produto cadastrado com sucesso"), 201


@app.get("/api/clientes")
def listar_clientes():
    clientes = acessar_supabase("GET", "clientes", {"select": "cliente_id, nome, email, telefone", "order": "nome.asc"})
    return jsonify(clientes)


@app.post("/api/clientes")
def cadastrar_clientes():
    dados_clientes = request.get_json(silent=True)
    if not isinstance(dados_clientes, dict):
        return jsonify(mensagem="preencha corretamente o formulário."), 400

    campos_cliente = ["nome", "email", "telefone"]
    for campo in campos_cliente:
        valor = dados_clientes.get(campo)
        if valor is None or not isinstance(valor, str) or not valor.strip():
            return jsonify(mensagem=f"O campo {campo} deve ser preenchido"), 400

    nome_cliente = dados_clientes["nome"].strip()
    email = dados_clientes["email"].strip()
    telefone = dados_clientes["telefone"].strip()

    if len(nome_cliente) < 3 or len(nome_cliente) > 80:
        return jsonify(mensagem="O campo nome deve conter de 3 a 80 caracteres"), 400
    if "@" not in email or "." not in email.split("@")[-1]:
        return jsonify(mensagem="o e-mail deve conter um formato válido"), 400
    if len(telefone) < 10 or len(telefone) > 15:
        return jsonify(mensagem="o campo telefone deve conter entre 10 e 15 caracteres"), 400

    acessar_supabase(
        "POST",
        "clientes",
        dados={
            "nome": nome_cliente,
            "email": email,
            "telefone": telefone,
        },
    )

    return jsonify(mensagem="cliente cadastrado com sucesso"), 201


@app.get("/api/carrinho")
def listar_carrinho():
    cliente_id = request.args.get("cliente_id", type=int)
    if cliente_id is None:
        return jsonify(mensagem="Selecione um cliente cadastrado para ver o carrinho."), 400

    # LIMITE: cliente não cadastrado não entra no carrinho. A API valida a existência do cliente antes de listar itens.
    clientes = acessar_supabase("GET", "clientes", {"select": "cliente_id", "cliente_id": f"eq.{cliente_id}"})
    if not clientes:
        return jsonify(mensagem="Cliente não cadastrado."), 403

    itens = acessar_supabase(
        "GET",
        "carrinho",
        {
            "select": "carrinho_id, quantidade, produtos(produto_id, nome, preco), clientes(cliente_id, nome)",
            "cliente_id": f"eq.{cliente_id}",
        },
    )
    return jsonify(itens)


@app.post("/api/carrinho")
def adicionar_ao_carrinho():
    dados = request.get_json(silent=True)
    if not isinstance(dados, dict):
        return jsonify(mensagem="Envie um objeto JSON válido."), 400

    cliente_id = dados.get("cliente_id")
    produto_id = dados.get("produto_id")
    quantidade = dados.get("quantidade")

    if cliente_id is None or produto_id is None or quantidade is None:
        return jsonify(mensagem="Cliente, produto e quantidade são obrigatórios."), 400


    clientes = acessar_supabase("GET", "clientes", {"select": "cliente_id", "cliente_id": f"eq.{cliente_id}"})
    if not clientes:
        return jsonify(mensagem="Cliente não cadastrado. Cadastre-se antes de usar o carrinho."), 403

    try:
        cliente_id = int(cliente_id)
        produto_id = int(produto_id)
        quantidade = int(quantidade)
    except (TypeError, ValueError):
        return jsonify(mensagem="Cliente, produto e quantidade devem ser números válidos."), 400

    if quantidade <= 0:
        return jsonify(mensagem="A quantidade deve ser maior que zero."), 400

    produtos = acessar_supabase("GET", "produtos", {"select": "produto_id, estoque, nome", "produto_id": f"eq.{produto_id}"})
    if not produtos:
        return jsonify(mensagem="Produto não encontrado."), 404

    estoque_disponivel = int(produtos[0].get("estoque", 0))
    if quantidade > estoque_disponivel:
        return jsonify(mensagem="Quantidade indisponível em estoque."), 400

    itens = acessar_supabase(
        "GET",
        "carrinho",
        {
            "select": "carrinho_id, quantidade, produto_id, cliente_id",
            "cliente_id": f"eq.{cliente_id}",
            "produto_id": f"eq.{produto_id}",
        },
    )

    if itens:
        item_existente = itens[0]
        nova_quantidade = int(item_existente.get("quantidade", 0)) + quantidade
        if nova_quantidade > estoque_disponivel:
            return jsonify(mensagem="A quantidade total do item excede o estoque disponível."), 400

        acessar_supabase(
            "PATCH",
            "carrinho",
            {"carrinho_id": f"eq.{item_existente['carrinho_id']}"},
            {"quantidade": nova_quantidade},
        )
    else:
        acessar_supabase(
            "POST",
            "carrinho",
            dados={
                "cliente_id": cliente_id,
                "produto_id": produto_id,
                "quantidade": quantidade,
            },
        )

    return jsonify(mensagem="Produto adicionado ao carrinho."), 201


@app.delete("/api/carrinho")
def remover_do_carrinho():
    dados = request.get_json(silent=True) or {}
    cliente_id = dados.get("cliente_id")
    carrinho_id = dados.get("carrinho_id")

    if cliente_id is None or carrinho_id is None:
        return jsonify(mensagem="Cliente e item são obrigatórios."), 400

    clientes = acessar_supabase("GET", "clientes", {"select": "cliente_id", "cliente_id": f"eq.{cliente_id}"})
    if not clientes:
        return jsonify(mensagem="Cliente não cadastrado."), 403

    acessar_supabase("DELETE", "carrinho", {"carrinho_id": f"eq.{carrinho_id}", "cliente_id": f"eq.{cliente_id}"})
    return jsonify(mensagem="Item removido do carrinho."), 200


@app.errorhandler(requests.exceptions.RequestException)
def tratar_erro_supabase(erro):
    app.logger.warning("falha ao acessar o supabase: %s", type(erro).__name__)

    if isinstance(erro, requests.exceptions.HTTPError):
        try:
            detalhe = erro.response.json()
        except ValueError:
            detalhe = {}

        if isinstance(detalhe, dict):
            codigo = detalhe.get("code")
            if codigo == "23505":
                return jsonify(mensagem="já existe um produto com este nome nesta categoria"), 409
            if codigo == "23503":
                return jsonify(mensagem="a categoria não está mais disponível. Atualize a página"), 405
            if codigo == "23514":
                return jsonify(mensagem="os dados não atendem às regras do banco"), 400

    return jsonify(mensagem="não foi possível acessar o banco, tente novamente"), 503


@app.errorhandler(500)
def tratar_erro_inesperado(erro):
    app.logger.exception("erro interno inesperado: %s", erro)
    return jsonify(mensagem="ocorreu uma falha interna"), 500


if __name__ == "__main__":
    app.run(host="127.0.0.1", port=5000, debug=False)
