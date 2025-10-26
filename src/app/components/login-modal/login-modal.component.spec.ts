import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { of, throwError } from 'rxjs';
import { LoginModalComponent } from './login-modal.component';
import { AuthService } from '../../services/auth.service';

describe('LoginModalComponent', () => {
  let component: LoginModalComponent;
  let fixture: ComponentFixture<LoginModalComponent>;
  let authService: jasmine.SpyObj<AuthService>;

  beforeEach(async () => {
    const authServiceSpy = jasmine.createSpyObj('AuthService', ['login']);

    await TestBed.configureTestingModule({
      imports: [LoginModalComponent],
      providers: [
        provideZonelessChangeDetection(),
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: AuthService, useValue: authServiceSpy },
      ],
    }).compileComponents();

    authService = TestBed.inject(AuthService) as jasmine.SpyObj<AuthService>;
    fixture = TestBed.createComponent(LoginModalComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should start with empty API key', () => {
    expect(component.apiKey()).toBe('');
  });

  it('should start with no error', () => {
    expect(component.error()).toBe(null);
  });

  it('should start with loading false', () => {
    expect(component.loading()).toBe(false);
  });

  it('should emit close event on cancel', () => {
    spyOn(component.close, 'emit');

    component.onCancel();

    expect(component.close.emit).toHaveBeenCalled();
  });

  it('should login successfully and emit close', () => {
    const testKey = 'test-api-key';
    component.apiKey.set(testKey);
    authService.login.and.returnValue(of('testuser'));
    spyOn(component.close, 'emit');

    component.onSubmit();

    expect(authService.login).toHaveBeenCalledWith(testKey);
    expect(component.loading()).toBe(false);
    expect(component.error()).toBe(null);
    expect(component.close.emit).toHaveBeenCalled();
  });

  it('should show error on login failure', () => {
    const testKey = 'invalid-key';
    const errorMessage = 'Invalid API key';
    component.apiKey.set(testKey);
    authService.login.and.returnValue(throwError(() => new Error(errorMessage)));

    component.onSubmit();

    expect(authService.login).toHaveBeenCalledWith(testKey);
    expect(component.loading()).toBe(false);
    expect(component.error()).toBe(errorMessage);
  });

  it('should set loading to true during login', () => {
    component.apiKey.set('test-key');
    authService.login.and.returnValue(of('testuser'));

    component.onSubmit();

    expect(component.loading()).toBe(false);
  });

  it('should clear error on submit', () => {
    component.error.set('Previous error');
    component.apiKey.set('test-key');
    authService.login.and.returnValue(of('testuser'));

    component.onSubmit();

    expect(component.error()).toBe(null);
  });
});
