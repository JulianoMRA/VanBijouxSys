import { describe, expect, it } from 'vitest'
import { ehNavegacaoInterna, urlExternaPermitida } from '../main/navegacao'

const APP_INSTALADO =
  'file:///C:/Users/van/AppData/Local/Programs/van-bijoux-sys/resources/app.asar/out/renderer/index.html'
const APP_DEV = 'http://localhost:5173/'

describe('ehNavegacaoInterna', () => {
  it('should_accept_same_document_with_another_fragment_because_router_is_hash', () => {
    expect(ehNavegacaoInterna(APP_INSTALADO, `${APP_INSTALADO}#/vendas`)).toBe(true)
    expect(ehNavegacaoInterna(`${APP_INSTALADO}#/produtos`, `${APP_INSTALADO}#/caixa`)).toBe(true)
    expect(ehNavegacaoInterna(APP_DEV, `${APP_DEV}#/insumos`)).toBe(true)
  })

  it('should_refuse_another_local_file_even_inside_the_app_folder', () => {
    expect(
      ehNavegacaoInterna(
        APP_INSTALADO,
        'file:///C:/Users/van/AppData/Local/Programs/van-bijoux-sys/resources/app.asar/out/renderer/outro.html'
      )
    ).toBe(false)
    expect(ehNavegacaoInterna(APP_INSTALADO, 'file:///C:/Users/van/Downloads/pagina.html')).toBe(
      false
    )
  })

  it('should_refuse_everything_when_window_has_no_page_yet', () => {
    expect(ehNavegacaoInterna('', 'https://exemplo.invalido')).toBe(false)
    expect(ehNavegacaoInterna('', APP_INSTALADO)).toBe(false)
  })

  it('should_refuse_host_that_only_starts_with_dev_server_host', () => {
    expect(ehNavegacaoInterna(APP_DEV, 'http://localhost:5173.exemplo.invalido/')).toBe(false)
  })

  it('should_refuse_other_port_protocol_or_path', () => {
    expect(ehNavegacaoInterna(APP_DEV, 'http://localhost:9999/')).toBe(false)
    expect(ehNavegacaoInterna(APP_DEV, 'https://localhost:5173/')).toBe(false)
    expect(ehNavegacaoInterna(APP_DEV, 'http://localhost:5173/outra')).toBe(false)
  })

  it('should_refuse_external_destination_and_dangerous_schemes', () => {
    expect(ehNavegacaoInterna(APP_INSTALADO, 'https://exemplo.invalido')).toBe(false)
    expect(ehNavegacaoInterna(APP_INSTALADO, 'javascript:alert(1)')).toBe(false)
    expect(ehNavegacaoInterna(APP_INSTALADO, 'data:text/html,<script>1</script>')).toBe(false)
  })

  it('should_refuse_malformed_url_on_either_side_without_throwing', () => {
    expect(ehNavegacaoInterna(APP_INSTALADO, 'nao e uma url')).toBe(false)
    expect(ehNavegacaoInterna('nao e uma url', APP_INSTALADO)).toBe(false)
  })
})

describe('urlExternaPermitida', () => {
  it('should_return_normalized_url_for_http_and_https', () => {
    expect(urlExternaPermitida('https://github.com/JulianoMRA/VanBijouxSys')).toBe(
      'https://github.com/JulianoMRA/VanBijouxSys'
    )
    expect(urlExternaPermitida('http://exemplo.invalido')).toBe('http://exemplo.invalido/')
  })

  it('should_refuse_any_scheme_other_than_http_or_https', () => {
    expect(urlExternaPermitida('javascript:alert(1)')).toBeNull()
    expect(urlExternaPermitida('file:///C:/Windows/System32/calc.exe')).toBeNull()
    expect(urlExternaPermitida('data:text/html,oi')).toBeNull()
    expect(urlExternaPermitida('ms-msdt:/id')).toBeNull()
  })

  it('should_refuse_malformed_string_without_throwing', () => {
    expect(urlExternaPermitida('')).toBeNull()
    expect(urlExternaPermitida('nao e uma url')).toBeNull()
  })
})
