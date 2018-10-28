/* global jsonld */

var realBase = "http://ethereum.ethstats.io"
var basePrefix = "eth:"
var ethon = "http://ethon.consensys.net/"
var termRegEx = new RegExp('(#|/)([^#/]*)$')
var titlePredicates = ['http://ethon.consensys.net/number', 'http://ethon.consensys.net/address', 'http://ethon.consensys.net/txHash', 'http://schema.org/name', 'http://schema.org/headline', 'http://purl.org/dc/terms/title', 'http://www.w3.org/2000/01/rdf-schema#label']

function replaceLocalBase(str) {
    return str.replace(window.location.protocol+'//'+window.location.host+'/', basePrefix)
}

function shortenHash(str) {
    return (str.substr(0, 8) + "..." + str.substr(str.length - 8, 8))
}

function parseAccount(str) {
    parts = str.split('_')
    return (parts[0] + " " + shortenHash(parts[1]))
}

function parseTx(str) {
    parts = str.split('_')
    return (parts[0] + " " + shortenHash(parts[1]))
}

function parseContractMsg(str) {
    parts = str.split('_')
    return (parts[0] + " " + shortenHash(parts[1]))
}

function parseLogEntry(str) {
    parts = str.split('_')
    return (parts[0] + " " + shortenHash(parts[1]))
}

function parseBlock(str) {
    parts = str.split('_')
    return (parts[0] + " " + shortenHash(parts[1]))
}

function iriLabel(iri) {
    var parts = termRegEx.exec(iri)
    //console.log(parts)
    //different handling of different types
    if (parts[2].startsWith("Account_")) {
        return parseAccount(parts[2])
    } else if (parts[2].startsWith("Block_")) {
        return parseBlock(parts[2])
    } else if (parts[2].startsWith("Tx_")) {
        return parseTx(parts[2])
    } else if (parts[2].startsWith("LogEntry_")) {
        return parseLogEntry(parts[2])
    } else if (parts[2].startsWith("ContractMsg_")) {
        return parseContractMsgy(parts[2])
    }

    if (!parts || parts.length === 0) {
        return null
    }

    return parts[parts.length - 1]
}

function subjectLabel(subject, titlePredicates) {
    return titlePredicates.reduce(function (label, titlePredicate) {
        return label || (titlePredicate in subject ? subject[titlePredicate][0]['@value'] : null)
    }, null)
}

function subjectSortId(subject, titlePredicates) {
    var label = subjectLabel(subject, titlePredicates) || subject['@id']
    if (subject['@id'].slice(0, 2) !== '_:') {
        return '0' + label // IRIs
    } else {
        return '1' + label // blank nodes
    }
}

function subjectSort(titlePredicates) {
    return function (a, b) {
        return subjectSortId(a, titlePredicates).localeCompare(subjectSortId(b, titlePredicates))
    }
}

function predicateLabel(iri, vocab) {
    var predicate = 'http://www.w3.org/2000/01/rdf-schema#label'
    var language = navigator.language || navigator.userLanguage
    for (var i = 0; i < vocab.length; i++) {
        var subject = vocab[i]

        if (subject['@id'] === iri && predicate in subject) {
            var objects = subject[predicate]

            for (var j = 0; j < objects.length; j++) {
                if (!('@language' in objects[j]) || objects[j]['@language'] === language) {
                    return objects[j]['@value']
                }
            }
        }
    }

    return iriLabel(iri)
}

function render(elementId, html) {
    var element = document.getElementById(elementId)

    if (element) {
        element.innerHTML = html
    }
}

function renderLink(iri, label) {
    var origin = window.location.origin

    // open IRIs with the same origin in the same tab, all others in a new tab
    if (iri.slice(0, origin.length) === origin) {
        return '<a href="' + iri + '" title="' + iri + '">' + label + '</a>'
    } else {
        return '<a href="' + iri + '" title="' + iri + '" target="_blank">' + label + '</a>'
    }
}

function renderTitle(graph, titlePredicates) {
    var subject = graph.filter(function (subject) {
        return subject['@id'] === decodeURIComponent(window.location.href)
    }).shift()

    if (!subject) {
        return ''
    }

    var title = subjectLabel(subject, titlePredicates)

    if (!title) {
        return ''
    }

    return '<h1>' + title + '</h1>'
}

function renderSticky(graph) {
    resourceUrl = replaceLocalBase(decodeURIComponent(window.location.href))
    var resource = '<h4>' + renderLink(resourceUrl,resourceUrl) + '</h4>'

    var subject = graph.filter(function (subject) {
        return subject['@id'] === decodeURIComponent(window.location.href)
    }).shift()

    var typeElements = ''

    if (subject && subject['@type']) {
        typeElements = 'this is a <h3>' + subject['@type'].map(function (type) {
            return renderLink(type, type.replace(ethon, ""))
        }).join(', ') + '</h3>'
    }

    var type = '<p>' + typeElements + '</p>'

    return '<span>' + resource + type + '</span>'
}

function renderPredicate(iri, label) {
    return renderLink(iri, '<b>' + (label || replaceLocalBase(iri)) + '</b>')
}

function renderIri(iri, label) {
    return renderLink(iri, label || replaceLocalBase(iri))
}

function renderBlankNode(blankNode) {
    return '<a href="#' + blankNode + '">' + blankNode + '</a>'
}

function renderLiteral(literal) {
    if (typeof literal === 'string') {
        return '<span>' + literal + '</span>'
    }
    else {
        if ('@language' in literal) {
            return '<span>' + literal['@value'] + ' @' + literal['@language'] + '</span>'
        } else if ('@type' in literal) {
            return '<span>' + literal['@value'] + ' (' + renderIri(literal['@type'], iriLabel(literal['@type'])) + ')</span>'
        } else {
            return '<span>' + literal['@value'] + '</span>'
        }
    }
}

function renderNode(node, label) {
    if (typeof node === 'object') {
        if ('@id' in node) {
            if (node['@id'].indexOf('_:') !== 0) {
                return renderIri(node['@id'], label)
            } else {
                return renderBlankNode(node['@id'])
            }
        } else {
            return renderLiteral(node)
        }
    } else {
        return renderLiteral(node)
    }
}

function renderTable(subject, vocab) {
    var head = '<thead class="table-subject"></thead>'

    if (subject['@id'] !== decodeURIComponent(window.location.href)) {
        head = '<thead><tr><th colspan="2">Incoming relations from ' + renderNode(subject) + '</th></tr></thead>'
    }

    var rows = Object.keys(subject).map(function (predicate) {
        var objects = subject[predicate]

        if (predicate.slice(0, 1) === '@') {
            if (predicate === '@type') {
                predicate = 'http://www.w3.org/1999/02/22-rdf-syntax-ns#type'

                objects = objects.map(function (type) {
                    return {'@id': type}
                })
            } else {
                return
            }
        }

        return objects.map(function (object) {
            return '<tr>' +
                '<td class="table-predicate col-lg-4">' + renderPredicate(predicate, predicateLabel(predicate, vocab)) + '</td>' +
                '<td class="table-object col-lg-8">' + renderNode(object, '@id' in object ? iriLabel(object['@id']) : '') + '</td>' +
                '</tr>'
        }).join('')
    }).join('')

    return '<table id="' + subject['@id'] + '" class="table table-striped table-graph">' +
        head +
        '<tbody>' + rows + '</tbody>' +
        '</table>'
}

function renderTables(graph, vocab, titlePredicates) {
    var subjects = graph.sort(subjectSort(titlePredicates))

    return subjects.map(function (subject) {
        return renderTable(subject, vocab)
    }).join('')
}

function embeddedGraph(elementId) {
    var element = document.getElementById(elementId)

    if (!element) {
        return Promise.resolve({})
    }

    var json = JSON.parse(element.innerHTML)

    return jsonld.promises.flatten(json, {}).then(function (flat) {
        return jsonld.promises.expand(flat).then(function (json) {
            // if data contains quads, use the first graph
            if (json.length && '@graph' in json[0]) {
                json = json[0]['@graph']
            }

            return json
        })
    })
}

Promise.all([
    embeddedGraph('vocab'),
    embeddedGraph('data')
]).then(function (results) {
    //console.log(results)
    var vocab = results[0]
    var graph = results[1]

    render('title', renderTitle(graph, titlePredicates))
    render('subtitle', renderSticky(graph))
    render('graph', renderTables(graph, vocab, titlePredicates))
}).catch(function (error) {
    console.error(error)
})
